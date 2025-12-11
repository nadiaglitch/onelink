from django.contrib import admin
from .models import Profile, Link


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "handle", "display_name", "created_at")
    search_fields = ("handle", "display_name", "user__username")
    list_filter = ("created_at",)
    ordering = ("handle",)


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "profile",
        "title",
        "url",
        "position",
        "created_at",
    )
    list_filter = ("profile",)
    search_fields = ("title", "url", "profile__handle")
    ordering = ("profile", "position", "id")
    list_editable = ("position",)