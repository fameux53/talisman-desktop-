from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery(
    "talisman",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Port-au-Prince",  # UTC-5
    enable_utc=True,
)

celery.conf.beat_schedule = {
    "generate-daily-reports": {
        "task": "app.tasks.reports.generate_daily_reports",
        "schedule": crontab(hour=21, minute=0),  # 9 PM Haiti time
    },
    "send-credit-reminders": {
        "task": "app.tasks.reminders.send_credit_reminders",
        "schedule": crontab(hour=10, minute=0),  # 10 AM Haiti time
    },
    "aggregate-pricing-data": {
        "task": "app.tasks.pricing.aggregate_pricing_data",
        "schedule": crontab(hour=6, minute=0, day_of_week="sunday"),
    },
}

celery.autodiscover_tasks(["app.tasks"])
