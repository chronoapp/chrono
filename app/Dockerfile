FROM python:3.7

RUN apt-get update -y
RUN apt-get install -y emacs
RUN apt-get install -y supervisor nginx build-essential
RUN rm /etc/nginx/sites-enabled/default

WORKDIR /app

# Prevents reinstallation of pip requirements if unchanged.
ADD ./requirements.txt /app/requirements.txt

# upgrade pip and install required python packages
RUN pip install -U pip
RUN pip install -r requirements.txt

ADD hier /
COPY . /app

CMD supervisord -n -c /etc/supervisord/supervisord.conf
