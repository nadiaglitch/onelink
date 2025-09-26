from django.db import models
from django.contrib.auth.models import User
from django.db.models.functions import Lower
from django.core.validators import RegexValidator
from django.urls import reverse

handle_validator = RegexValidator(
    regex=r"^[a-z0-9_]{5,15}$",
    message="Handle must be 5–15 chars, lowercase letters, numbers, or underscore."
)

# Create your models here.

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    handle = models.CharField(max_length=15, unique=True)
    display_name = models.CharField(max_length=50)
    bio = models.TextField(blank=True)
    profile_image = models.ImageField(upload_to="profiles/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Case-insensitive uniqueness for handle (Postgres recommended)
        constraints = [
            models.UniqueConstraint(Lower("handle"), name="uniq_profile_handle_ci")
        ]

    def __str__(self):
        return f"@{self.handle}"

    def get_absolute_url(self):
        # e.g. /onelink/@nadia
        return reverse("profile-detail", kwargs={"handle": self.handle})

class Link(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="links")
    title = models.CharField(max_length=100)
    url = models.URLField()
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        ordering = ["sort_order"]
        # Ensure no duplicate sort positions per profile
        constraints = [
            models.UniqueConstraint(fields=["profile", "sort_order"], name="uniq_link_sort_per_profile")
        ]
        indexes = [
            models.Index(fields=["profile", "sort_order"]),
        ]

    def __str__(self):
        return f"{self.title} → {self.url}"