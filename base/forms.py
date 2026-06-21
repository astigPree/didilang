from django import forms


class PlaceSubmissionForm(forms.Form):
    submitter_name = forms.CharField(
        label='Pangalan mo',
        max_length=255,
        widget=forms.TextInput(attrs={'placeholder': 'Juan Dela Cruz'}),
    )
    submitter_email = forms.EmailField(
        label='Email',
        required=False,
        widget=forms.EmailInput(attrs={'placeholder': 'juan@email.com'}),
    )
    submitter_facebook = forms.CharField(
        label='Facebook',
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'Facebook profile o page link'}),
    )
    name = forms.CharField(
        label='Pangalan ng lugar',
        max_length=255,
        widget=forms.TextInput(attrs={'placeholder': 'Hal. Aling Nena Eatery'}),
    )
    category = forms.CharField(
        label='Kategorya',
        max_length=255,
        widget=forms.TextInput(attrs={'placeholder': 'Kainan, barberya, laundry...'}),
    )
    rating = forms.FloatField(
        label='Rating',
        min_value=0,
        max_value=5,
        widget=forms.NumberInput(
            attrs={
                'placeholder': 'Hal. 4.5',
                'min': '0',
                'max': '5',
                'step': '0.1',
            }
        ),
        help_text='0 hanggang 5 stars.',
    )
    address = forms.CharField(
        label='Address o landmark',
        max_length=255,
        widget=forms.TextInput(attrs={'placeholder': 'Street, barangay, o malapit na landmark'}),
    )
    profile = forms.ImageField(
        label='Larawan ng lugar',
        help_text='Awtomatikong pinapaliit sa browser ang malalaking larawan bago i-upload.',
        widget=forms.ClearableFileInput(attrs={'accept': 'image/*'}),
    )
    lat = forms.FloatField(widget=forms.HiddenInput())
    lng = forms.FloatField(widget=forms.HiddenInput())

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('submitter_email')
        facebook = cleaned_data.get('submitter_facebook')
        lat = cleaned_data.get('lat')
        lng = cleaned_data.get('lng')

        if not email and not facebook:
            raise forms.ValidationError('Maglagay ng email o Facebook para ma-contact ka pagkatapos ng review.')

        if lat is None or lng is None:
            raise forms.ValidationError('Pumili ng lokasyon sa mapa bago mag-submit.')

        if lat is not None and not -90 <= lat <= 90:
            self.add_error('lat', 'Hindi valid ang latitude.')

        if lng is not None and not -180 <= lng <= 180:
            self.add_error('lng', 'Hindi valid ang longitude.')

        return cleaned_data
