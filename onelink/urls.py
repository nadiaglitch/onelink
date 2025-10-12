# onelink/urls.py
from django.contrib import admin
from django.urls import path, include
from profiles import views as profile_views
from profiles.views import ProfileLoginView, ProfileLogoutView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth (use your custom views so messages are added)
    path("accounts/login/",  ProfileLoginView.as_view(),  name="login"),
    path("accounts/logout/", ProfileLogoutView.as_view(), name="logout"),
    path("accounts/register/", profile_views.register,    name="register"),

    # App
    path("", profile_views.index, name="index"),
    path("", include("profiles.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)