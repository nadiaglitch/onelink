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

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    handle = models.CharField(max_length=15, unique=True, validators=[handle_validator], db_index=True)
    display_name = models.CharField(max_length=50)
    bio = models.TextField(blank=True)
    profile_image = models.ImageField(upload_to="profiles/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Case-insensitive uniqueness for handle
            models.UniqueConstraint(Lower("handle"), name="uniq_profile_handle_ci")
        ]

    def clean(self):
        super().clean()
        if self.handle:
            self.handle = self.handle.lower()

    def __str__(self):
        return f"@{self.handle}"

    def get_absolute_url(self):
        return reverse("profile-detail", kwargs={"handle": self.handle})

    def save(self, *args, **kwargs):
        if self.handle:
            self.handle = self.handle.lower()
        super().save(*args, **kwargs)


class Link(models.Model):
    profile = models.ForeignKey(Profile, related_name="links", on_delete=models.CASCADE)
    title = models.CharField(max_length=255, blank=True)
    url = models.URLField()
    # the ordering key (renamed from sort_order)
    position = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(fields=["profile", "position"], name="uniq_link_position_per_profile")
        ]
        indexes = [
            models.Index(fields=["profile", "position"]),
        ]

    def __str__(self):
        return f"{self.title or self.url} → {self.url}"

    def save(self, *args, **kwargs):
        from django.db.models import Max as DjMax
        if self.profile_id and self.position is None:
            with transaction.atomic():
                max_pos = (
                    Link.objects.select_for_update()
                    .filter(profile_id=self.profile_id)
                    .aggregate(DjMax("position"))["position__max"]
                )
                self.position = (max_pos or 0) + 1
        super().save(*args, **kwargs)