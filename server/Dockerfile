FROM tiangolo/uvicorn-gunicorn-fastapi:python3.7

RUN apt-get update -y &&\
    apt-get install -y emacs supervisor

ADD ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

ADD hier /
COPY . /app

ENV PYTHONPATH=/app

CMD supervisord -n -c /etc/supervisord/supervisord.conf
