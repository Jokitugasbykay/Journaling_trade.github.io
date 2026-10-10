FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/pro_api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home journal
COPY services/pro_api /app/services/pro_api
USER 10001
EXPOSE 8789
CMD ["uvicorn", "services.pro_api.app:app", "--host", "0.0.0.0", "--port", "8789", "--no-access-log"]
