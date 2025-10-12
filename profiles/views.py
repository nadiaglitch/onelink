import json
import re
from django.db.models import F
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout  
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, LogoutView
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
    Profile,
    Link,
    form=LinkForm,
    extra=1,          # give one blank row to create a new link
    can_delete=True,
    can_order=True    # you sort by ORDER in your view; enable it in the formset
)

def _ensure_profile_for(user):
    return Profile.objects.get_or_create(
        user=user,
        defaults={"handle": f"user{user.id}", "display_name": user.username or f"User {user.id}"},
    )

class ProfileLoginView(LoginView):
    """
    Uses your index page form posting to 'login'.
    Success redirect is controlled by Django (next=..., or settings.LOGIN_REDIRECT_URL),
    which in your project points to 'post-login-redirect'.
    """
    def form_valid(self, form):
        messages.success(self.request, "You are now logged in")
        return super().form_valid(form)

class ProfileLogoutView(View):
    """
    Explicitly log the user out, then add the message, then redirect to index.
    Doing it ourselves avoids any ordering issues with session/message storage.
    """
    def get(self, request, *args, **kwargs):
        logout(request)  # flushes session
        messages.success(request, "You are now logged out")
        return redirect("index")

    def post(self, request, *args, **kwargs):
        logout(request)
        messages.success(request, "You are now logged out")
        return redirect("index")
    
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

# ---------- Option A helper ----------
def _is_real_formset_submission(post):
    """
    True if POST contains any inline formset field beyond the management keys,
    regardless of the formset prefix (e.g., 'link_set-0-url', 'form-1-DELETE').
    """
    mgmt_suffixes = {"TOTAL_FORMS", "INITIAL_FORMS", "MIN_NUM_FORMS", "MAX_NUM_FORMS"}
    for k in post.keys():
        # matches "<prefix>-<number>-<field>"
        if re.match(r'^[^-]+-\d+-', k):
            last = k.rsplit("-", 1)[-1]
            if last not in mgmt_suffixes:
                return True
    return False
# ------------------------------------

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

        # Bind the formset ONLY if there are real link fields present (not just management form)
        if _is_real_formset_submission(request.POST):
            formset = LinkFormSet(
                request.POST,
                instance=profile,
                queryset=profile.links.order_by("position", "id"),
            )
            formset_valid = formset.is_valid()
        else:
            formset = LinkFormSet(
                instance=profile,
                queryset=profile.links.order_by("position", "id"),
            )
            formset_valid = True

        if not (pform.is_valid() and formset_valid):
            messages.error(request, "Please fix the errors below.")
            return render(request, self.template_name, {"pform": pform, "formset": formset, "profile": profile})

        with transaction.atomic():
            profile = pform.save()

            if _is_real_formset_submission(request.POST):
                # Populate formset.deleted_objects
                instances = formset.save(commit=False)

                # 1) Delete the ones ticked for deletion
                to_delete = [obj for obj in getattr(formset, "deleted_objects", []) if obj.pk]
                if to_delete:
                    for obj in to_delete:
                        obj.delete()

                # 2) Bump positions for remaining rows to avoid unique collisions
                Link.objects.filter(profile=profile).update(position=F('position') + 1000)

                # 3) Save the forms we are keeping, in the requested order, with final positions
                cleaned_forms = [
                    f for f in formset.forms
                    if f.cleaned_data and not f.cleaned_data.get("DELETE")
                ]
                ordered_forms = sorted(cleaned_forms, key=lambda f: f.cleaned_data.get("ORDER") or 0)

                for idx, f in enumerate(ordered_forms, start=1):
                    link = f.save(commit=False)
                    link.profile = profile
                    link.position = idx
                    link.save()
                # If you add M2M on Link in future: formset.save_m2m()

        messages.success(request, "Profile updated.")
        # Redirect back to the editor so the success banner renders there
        return redirect(request.path)

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
        resp = super().form_valid(form)
        messages.success(self.request, "Link created.")
        return resp

class LinkUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    model = Link
    fields = ["title", "url"]
    template_name = "profiles/link_form.html"
    success_url = reverse_lazy("link-list")
    def get_object(self, queryset=None):
        obj = super().get_object(queryset)
        self.object = obj
        return obj
    def form_valid(self, form):
        resp = super().form_valid(form)
        messages.success(self.request, "Link updated.")
        return resp

class LinkDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    model = Link
    template_name = "profiles/link_confirm_delete.html"
    success_url = reverse_lazy("link-list")
    def get_object(self, queryset=None):
        obj = super().get_object(queryset)
        self.object = obj
        return obj
    
    def delete(self, request, *args, **kwargs):
        messages.success(request, "Link deleted.")
        return super().delete(request, *args, **kwargs)

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

def debug_msg(request):
    messages.success(request, "Hello from messages framework!")
    return redirect("index") 