from django import forms
from django.forms import inlineformset_factory
from .models import Profile, Link

class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ["display_name", "bio", "profile_image", "handle"]
        widgets = {
            "bio": forms.Textarea(attrs={"rows": 3}),
        }

class LinkForm(forms.ModelForm):
    class Meta:
        model = Link
        fields = ["title", "url", "sort_order"]

LinkFormSet = inlineformset_factory(
    parent_model=Profile,
    model=Link,
    form=LinkForm,
    fields=["title", "url", "sort_order"],
    extra=2,
    can_delete=True,
    can_order=True,   # adds an ORDER field per form
)
