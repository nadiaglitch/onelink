import json
from django.views.decorators.http import require_POST
from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.forms import inlineformset_factory
from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.generic import DetailView, ListView, CreateView, UpdateView, DeleteView, View
from django.urls import reverse_lazy
from django.db import transaction

from .models import Profile, Link
from .forms import ProfileForm, LinkForm

LinkFormSet = inlineformset_factory(
    Profile, Link, form=LinkForm, extra=0, can_delete=True
)

def _ensure_profile_for(user):
    return Profile.objects.get_or_create(
        user=user,
        defaults={"handle": f"user{user.id}", "display_name": user.username or f"User {user.id}"},
    )

class ProfileLoginView(LoginView):
    def get_success_url(self):
        user = self.request.user
        profile, _ = _ensure_profile_for(user)
        return profile.get_absolute_url()

def index(request):
    if request.user.is_authenticated:
        profile, _ = _ensure_profile_for(request.user)
        return redirect(profile.get_absolute_url())
    form = AuthenticationForm(request)
    return render(request, "index.html", {"form": form})

class ProfileDetailView(DetailView):
    model = Profile
    template_name = "profiles/profile_detail.html"
    context_object_name = "profile"

    def get_object(self):
        return get_object_or_404(Profile, handle=self.kwargs["handle"])

class OwnerRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        if hasattr(self, "object") and self.object:
            return getattr(self.object.profile, "user_id", None) == self.request.user.id
        return self.request.user.is_authenticated

class ProfileLinksEditorView(LoginRequiredMixin, View):
    template_name = "profiles/profile_links.html"

    def get(self, request):
        profile, _ = _ensure_profile_for(request.user)
        pform = ProfileForm(instance=profile)
        formset = LinkFormSet(instance=profile, queryset=profile.links.order_by("position", "id"))
        return render(request, self.template_name, {"pform": pform, "formset": formset, "profile": profile})

    def post(self, request):
        profile, _ = _ensure_profile_for(request.user)
        pform = ProfileForm(request.POST, request.FILES, instance=profile)

        if "form-TOTAL_FORMS" in request.POST:
            formset = LinkFormSet(request.POST, instance=profile, queryset=profile.links.order_by("position", "id"))
            formset_valid = formset.is_valid()
        else:
            formset = LinkFormSet(instance=profile, queryset=profile.links.order_by("position", "id"))
            formset_valid = True

        if not (pform.is_valid() and formset_valid):
            messages.error(request, "Please fix the errors below.")
            return render(request, self.template_name, {"pform": pform, "formset": formset, "profile": profile})

        with transaction.atomic():
            pform.save()
            if "form-TOTAL_FORMS" in request.POST:
                for obj in formset.deleted_objects:
                    obj.delete()
                cleaned = [f for f in formset.forms if f.cleaned_data and not f.cleaned_data.get("DELETE")]
                ordered_forms = sorted(cleaned, key=lambda f: f.cleaned_data.get("ORDER", 0))
                for idx, f in enumerate(ordered_forms, start=1):
                    link = f.save(commit=False)
                    link.profile = profile
                    link.position = idx
                    link.save()

        messages.success(request, "Profile & links updated.")
        return redirect("link-list")

class LinkListView(LoginRequiredMixin, ListView):
    model = Link
    template_name = "profiles/link_list.html"
    context_object_name = "links"

    def get_queryset(self):
        profile, _ = _ensure_profile_for(self.request.user)
        return profile.links.order_by("position", "id")

class LinkCreateView(LoginRequiredMixin, CreateView):
    model = Link
    fields = ["title", "url"]
    template_name = "profiles/link_form.html"
    success_url = reverse_lazy("link-list")
    def form_valid(self, form):
        form.instance.profile = self.request.user.profile
        return super().form_valid(form)

class LinkUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    model = Link
    fields = ["title", "url"]
    template_name = "profiles/link_form.html"
    success_url = reverse_lazy("link-list")
    def get_object(self, queryset=None):
        obj = super().get_object(queryset)
        self.object = obj
        return obj

class LinkDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    model = Link
    template_name = "profiles/link_confirm_delete.html"
    success_url = reverse_lazy("link-list")
    def get_object(self, queryset=None):
        obj = super().get_object(queryset)
        self.object = obj
        return obj

def register(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Welcome to OneLink! Your account has been created.")
            return redirect("link-list")
    else:
        form = UserCreationForm()
    return render(request, "register.html", {"form": form})

@login_required
def post_login_redirect(request):
    next_url = request.GET.get("next")
    if next_url:
        return redirect(next_url)
    user = request.user
    handle = getattr(getattr(user, "profile", None), "handle", None) or user.username
    return redirect("profile-detail", handle=handle)

def public_profile(request, handle):
    profile = get_object_or_404(Profile, handle=handle.lower())
    links = profile.links.order_by("position", "id")
    return render(request, "profiles/profile_detail.html", {"profile": profile, "links": links})