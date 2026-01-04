# Use Python 3.13 slim base image
FROM public.ecr.aws/docker/library/python:3.13-slim

# Copy AWS Lambda Web Adapter to enable running web servers on Lambda
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Set environment variables for Lambda Web Adapter
ENV PORT=8000
ENV AWS_LWA_READINESS_CHECK_PATH=/
ENV AWS_LWA_ASYNC_INIT=true

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN python -m pip install -r requirements.txt

# Copy server code
COPY server.py .

# Copy pre-built widget (build before docker build)
COPY web/dist/ web/dist/

# Note: Do NOT copy .env files to production
# Set MacroMicro_API and other secrets via Lambda environment variables

# Run uvicorn server (exec form ensures proper signal handling)
CMD ["sh", "-c", "exec uvicorn --host=0.0.0.0 --port=$PORT server:app"]
