from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Profile

@receiver(post_save, sender=User)
def create_profile_for_user(sender, instance, created, **kwargs):
    if created and not hasattr(instance, "profile"):
        # pick a temporary unique handle; user can change it later
        base = (instance.username or f"user{instance.id}").lower()
        handle = base[:15] or f"user{instance.id}"
        # ensure uniqueness if needed
        i, orig = 1, handle
        while Profile.objects.filter(handle=handle).exists():
            suffix = str(i)
            handle = (orig[: max(0, 15 - len(suffix))] + suffix) or f"user{instance.id}"
            i += 1

        Profile.objects.create(
            user=instance,
            handle=handle,
            display_name=instance.username or f"User {instance.id}",
        )
