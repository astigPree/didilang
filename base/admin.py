from django.contrib import admin

from .models import CreatedBy, Place


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'address',
        'rating',
        'is_public',
        'is_active',
        'created_by',
        'created_at',
    )
    list_filter = ('is_public', 'is_active', 'category', 'created_at')
    search_fields = (
        'name',
        'category',
        'address',
        'created_by__name',
        'created_by__email',
        'created_by__facebook',
    )
    ordering = ('name',)


@admin.register(CreatedBy)
class CreatedByAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'facebook')
    search_fields = ('name', 'email', 'facebook')
    ordering = ('name',)
