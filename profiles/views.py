# onelink/profiles/views.py
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.views.generic import DetailView, ListView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy, reverse
from django.views.decorators.http import require_POST
from django.db import models, transaction

from .models import Profile, Link

def index(request):
    return HttpResponse("Hello, this is the profiles index page.")

# PUBLIC: /@handle
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

# LIST (owner’s links)
class LinkListView(LoginRequiredMixin, ListView):
    model = Link
    template_name = "profiles/link_list.html"
    context_object_name = "links"

    def get_queryset(self):
        return Link.objects.filter(profile=self.request.user.profile).order_by("sort_order")

# CREATE
class LinkCreateView(LoginRequiredMixin, CreateView):
    model = Link
    fields = ["title", "url"]  # sort_order auto via model.save()
    template_name = "profiles/link_form.html"
    success_url = reverse_lazy("link-list")

    def form_valid(self, form):
        form.instance.profile = self.request.user.profile
        # sort_order left as None → auto-numbering in model.save()
        return super().form_valid(form)

# UPDATE
class LinkUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    model = Link
    fields = ["title", "url"]
    template_name = "profiles/link_form.html"
    success_url = reverse_lazy("link-list")

    def get_object(self, queryset=None):
        obj = super().get_object(queryset)
        self.object = obj
        return obj

# DELETE
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

    # stable 1..n ordering without clashes
    with transaction.atomic():
        for idx, link_id in enumerate(ordered_ids, start=1):
            Link.objects.filter(id=link_id).update(sort_order=idx)

    return JsonResponse({"ok": True})