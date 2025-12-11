# onelink/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from profiles import views as profile_views
from profiles.views import ProfileLoginView, ProfileLogoutView


urlpatterns = [
    path("admin/", admin.site.urls),

    # Authentication routes (custom views)
    path("accounts/login/", ProfileLoginView.as_view(), name="login"),
    path("accounts/logout/", ProfileLogoutView.as_view(), name="logout"),
    path("accounts/register/", profile_views.register, name="register"),

    # Main app
    path("", profile_views.index, name="index"),
    path("", include("profiles.urls")),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )