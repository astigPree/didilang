from django.db import models
from django.utils import timezone

# Create your models here.


class CreatedBy(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    facebook = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Place(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=255)
    rating = models.FloatField()
    lat = models.FloatField()
    lng = models.FloatField()
    address = models.CharField(max_length=255)
    profile = models.ImageField(upload_to='profile') 

    created_by = models.ForeignKey(CreatedBy, on_delete=models.SET_NULL, null=True, blank=True)
    is_public = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

 