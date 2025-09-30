from django.db import models, transaction
from django.contrib.auth.models import User
from django.db.models.functions import Lower
from django.core.validators import RegexValidator
from django.urls import reverse

username_validator = RegexValidator(
    regex=r"^[a-z0-9_]{5,15}$",
    message="Username must be 5–15 chars, lowercase letters, numbers, or underscore."
)

handle_validator = RegexValidator(
    regex=r"^[a-z0-9_]{5,15}$",
    message="Handle must be 5–15 chars, lowercase letters, numbers, or underscore."
)

# Create your models here.

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    handle = models.CharField(
        max_length=15, 
        unique=True,
        validators=[handle_validator],
        db_index=True)
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

    def clean(self):
        # Ensure handle is always lowercase
        super().clean()
        if self.handle:
            self.handle = self.handle.lower()

    def __str__(self):
        return f"@{self.handle}"

    def get_absolute_url(self):
        # e.g. /onelink/@nadia
        return reverse("profile-detail", kwargs={"handle": self.handle})

class Link(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="links")
    title = models.CharField(max_length=100)
    url = models.URLField()
    sort_order = models.PositiveIntegerField(blank=True, null=True, db_index=True)
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

    def save(self, *args, **kwargs):
        # Auto-assign next sort_order (1, 2, 3, …) per profile
        # Ensure handle is always lowercase
        if self.handle:
            self.handle = self.handle.lower()
        if self.sort_order is None and self.profile_id:
            with transaction.atomic():
                max_sort = (
                    Link.objects
                    .select_for_update()
                    .filter(profile_id=self.profile_id)
                    .aggregate(models.Max("sort_order"))["sort_order__max"]
                )
                self.sort_order = (max_sort or 0) + 1
        super().save(*args, **kwargs)