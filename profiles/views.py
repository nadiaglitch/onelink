from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.forms import inlineformset_factory
from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.views.generic import DetailView, ListView, CreateView, UpdateView, DeleteView, View
from django.urls import reverse_lazy, reverse
from django.views.decorators.http import require_POST
from django.db import models, transaction
from .models import Profile, Link
from .forms import ProfileForm, LinkForm, LinkFormSet

LinkFormSet = inlineformset_factory(
    Profile,
    Link,
    form=LinkForm,
    extra=0,
    can_delete=True
)

def _ensure_profile_for(user):
    """
    Ensure the authenticated user has a Profile.
    Returns (profile, created_bool).
    """
    return Profile.objects.get_or_create(
        user=user,
        defaults={
            "handle": f"user{user.id}",
            "display_name": user.username or f"User {user.id}",
        },
    )


class ProfileLoginView(LoginView):
    """Custom login that always redirects to the user's live public profile."""
    def get_success_url(self):
        user = self.request.user
        profile, _ = _ensure_profile_for(user)
        return profile.get_absolute_url()


def index(request):
    """
    If logged in → send straight to the live public profile (/@handle).
    Otherwise render the index with a login form.
    """
    if request.user.is_authenticated:
        profile, _ = _ensure_profile_for(request.user)
        return redirect(profile.get_absolute_url())

    form = AuthenticationForm(request)
    return render(request, "index.html", {"form": form})


# PUBLIC: /@<handle>
class ProfileDetailView(DetailView):
    model = Profile
    template_name = "profiles/profile_detail.html"
    context_object_name = "profile"

    def get_object(self):
        return get_object_or_404(Profile, handle=self.kwargs["handle"])


# OWNER-ONLY guard
class OwnerRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        # current user must own the profile referenced by the object
        if hasattr(self, "object") and self.object:
            return getattr(self.object.profile, "user_id", None) == self.request.user.id
        # for list/create, check against the user profile
        return self.request.user.is_authenticated


# Profile + Links editor at /links
class ProfileLinksEditorView(LoginRequiredMixin, View):
    template_name = "profiles/profile_links.html"

    def get(self, request):
        profile, _ = _ensure_profile_for(request.user)
        pform = ProfileForm(instance=profile)
        formset = LinkFormSet(instance=profile, queryset=profile.links.order_by("sort_order"))
        return render(request, self.template_name, {"pform": pform, "formset": formset, "profile": profile})

    def post(self, request):
        profile, _ = _ensure_profile_for(request.user)
        pform = ProfileForm(request.POST, request.FILES, instance=profile)

        # Only validate/process the link formset if it was actually submitted
        # (i.e., management form present).
        if "form-TOTAL_FORMS" in request.POST:
            formset = LinkFormSet(request.POST, instance=profile, queryset=profile.links.order_by("sort_order"))
            formset_valid = formset.is_valid()
        else:
            # No link submission — keep an unbound formset so the page can re-render fine.
            formset = LinkFormSet(instance=profile, queryset=profile.links.order_by("sort_order"))
            formset_valid = True

        if not (pform.is_valid() and formset_valid):
            messages.error(request, "Please fix the errors below.")
            return render(request, self.template_name, {"pform": pform, "formset": formset, "profile": profile})

        with transaction.atomic():
            # Save profile fields (display_name, handle, bio, profile_image)
            pform.save()

            # If links were submitted, save them too (keeping sort order)
            if "form-TOTAL_FORMS" in request.POST:
                # Delete any marked-for-deletion links
                for obj in formset.deleted_objects:
                    obj.delete()

                cleaned = [f for f in formset.forms if f.cleaned_data and not f.cleaned_data.get("DELETE")]
                ordered_forms = sorted(cleaned, key=lambda f: f.cleaned_data.get("ORDER", 0))
                for idx, f in enumerate(ordered_forms, start=1):
                    link = f.save(commit=False)
                    link.profile = profile
                    link.sort_order = idx
                    link.save()

        messages.success(request, "Profile & links updated.")
        # Redirect back to the editor
        return redirect("link-list")


# (Optional legacy CRUD: you can keep/remove as you wish)

class LinkListView(LoginRequiredMixin, ListView):
    model = Link
    template_name = "profiles/link_list.html"
    context_object_name = "links"
    def get_queryset(self):
        profile, _ = _ensure_profile_for(self.request.user)
        return profile.links.order_by("sort_order")


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


# REORDER (POST with JSON: {"ordered_ids":[3,1,2,...]})
@require_POST
def link_reorder(request):
    if not request.user.is_authenticated:
        return HttpResponseBadRequest("Not authenticated")

    ordered_ids = request.POST.getlist("ordered_ids[]") or None
    if ordered_ids is None:
        # support JSON payloads too
        try:
            import json
            data = json.loads(request.body.decode("utf-8"))
            ordered_ids = data.get("ordered_ids")
        except Exception:
            return HttpResponseBadRequest("Invalid payload")

    ordered_ids = [int(x) for x in ordered_ids]

    # ensure all belong to the requesting user
    qs = Link.objects.filter(id__in=ordered_ids, profile=request.user.profile)
    if qs.count() != len(ordered_ids):
        return HttpResponseBadRequest("IDs mismatch or unauthorized")

    with transaction.atomic():
        for idx, link_id in enumerate(ordered_ids, start=1):
            Link.objects.filter(id=link_id).update(sort_order=idx)

    return JsonResponse({"ok": True})

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # automatically log them in
            messages.success(request, "Welcome to OneLink! Your account has been created.")
            return redirect('link-list')  # redirect to edit/profile page
    else:
        form = UserCreationForm()
    return render(request, 'register.html', {'form': form})

@login_required
def post_login_redirect(request):
    """
    After a successful login, send the user to their public profile page.
    Prefers profile.handle; falls back to username if needed.
    Also respects ?next=... if Django didn't already handle it.
    """
    # If for some reason ?next= is still present, honor it.
    next_url = request.GET.get("next")
    if next_url:
        return redirect(next_url)

    user = request.user
    handle = getattr(getattr(user, "profile", None), "handle", None) or user.username
    return redirect("profile-detail", handle=handle)

def links_list(request):
    profile = request.user.profile
    formset = LinkFormSet(instance=profile, queryset=Link.objects.filter(profile=profile))
    # ...
    return render(request, "profiles/links_list.html", {"formset": formset, "links": profile.link_set.all()})