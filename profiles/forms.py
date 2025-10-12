from django import forms
from django.core.validators import RegexValidator
from .models import Profile, Link

handle_validator = RegexValidator(
    regex=r"^[a-z0-9_]{5,15}$",
    message="Handle must be 5–15 chars, lowercase letters, numbers, or underscore."
)

class ProfileForm(forms.ModelForm):
    handle = forms.CharField(
        max_length=15,
        validators=[handle_validator],
        widget=forms.TextInput(attrs={
            "autocomplete": "off",
            "autocapitalize": "none",
            "spellcheck": "false",
            "maxlength": "15",
        }),
    )

    class Meta:
        model = Profile
        fields = ["display_name", "handle", "bio", "profile_image"]

    def clean_handle(self):
        return (self.cleaned_data.get("handle") or "").strip().lower()


class LinkForm(forms.ModelForm):
    class Meta:
        model = Link
        fields = ["title", "url"]
        widgets = {
            "title": forms.TextInput(attrs={
                "class": "editable-text link-title",
                "placeholder": "Display title",
            }),
            "url": forms.URLInput(attrs={
                "class": "editable-text link-url",
                "placeholder": "https://example.com",
            }),
        }