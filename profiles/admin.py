from django.contrib import admin
from .models import Profile, Link

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("handle", "user", "display_name", "created_at")
    search_fields = ("handle", "display_name", "user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")

@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ("title", "profile", "sort_order", "updated_at")
    list_editable = ("sort_order",)
    search_fields = ("title", "url", "profile__handle")
    list_filter = ("profile",)