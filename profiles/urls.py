from django.urls import path
from . import views as profile_views


urlpatterns = [
    path("", profile_views.index, name="index"),

    path(
        "post-login-redirect/",
        profile_views.post_login_redirect,
        name="post-login-redirect",
    ),

    # Link management
    path(
        "links/",
        profile_views.ProfileLinksEditorView.as_view(),
        name="link-list",
    ),
    path(
        "links/create/",
        profile_views.LinkCreateView.as_view(),
        name="link-create",
    ),
    path(
        "links/<int:pk>/edit/",
        profile_views.LinkUpdateView.as_view(),
        name="link-update",
    ),
    path(
        "links/<int:pk>/delete/",
        profile_views.LinkDeleteView.as_view(),
        name="link-delete",
    ),

    # Public profile (handle-based)
    path(
        "@<str:handle>",
        profile_views.public_profile,
        name="profile-detail",
    ),
]