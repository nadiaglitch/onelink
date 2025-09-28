# onelink/profiles/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # public profile page: /@nadia
    path("@<str:handle>/", views.ProfileDetailView.as_view(), name="profile-detail"),

    # link CRUD (owner only)
    path("links/", views.LinkListView.as_view(), name="link-list"),
    path("links/new/", views.LinkCreateView.as_view(), name="link-create"),
    path("links/<int:pk>/edit/", views.LinkUpdateView.as_view(), name="link-update"),
    path("links/<int:pk>/delete/", views.LinkDeleteView.as_view(), name="link-delete"),

    # quick reorder endpoint (POST)
    path("links/reorder/", views.link_reorder, name="link-reorder"),
]
