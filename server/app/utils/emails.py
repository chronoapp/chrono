import requests
from jinja2 import Environment, PackageLoader
from requests.auth import HTTPBasicAuth

from app.core import config
from app.core.logger import logger

Template = Environment(loader=PackageLoader('app', 'templates'))


def _sendEmailMailgun(subject: str, text: str, recipient: str, replyTo=None, files=None):
    if not config.MAILGUN_API_KEY or not config.MAILGUN_API_URL:
        logger.warning('Mailgun API key not found.')
        return

    data = {
        'subject': subject,
        'html': text,
        'from': config.EMAIL_FROM_USER,
        'to': recipient,
    }

    if replyTo is not None:
        data['h:Reply-To'] = replyTo

    resp = requests.post(
        config.MAILGUN_API_URL,
        auth=HTTPBasicAuth('api', config.MAILGUN_API_KEY),
        files=files,
        data=data,
    )

    return resp.json()


def _sendEmailPostmark(subject: str, body: str, recipient: str):
    if not config.POSTMARK_API_KEY:
        logger.warning('Postmark API key not found.')
        return

    else:
        data = {
            "From": config.EMAIL_FROM_USER,
            "To": recipient,
            "Subject": subject,
            "HtmlBody": body,
            "MessageStream": "outbound",
        }

        response = requests.post(
            config.POSTMARK_API_URL,
            headers={"X-Postmark-Server-Token": config.POSTMARK_API_KEY},
            json=data,
        )

        return response.json()


def sendEmail(
    subject: str,
    body: str,
    recipient: str,
):
    """TODO: Use SMTP instead of API Key to support email providers."""
    if config.EMAIL_PROVIDER == 'mailgun':
        return _sendEmailMailgun(subject, body, recipient)
    elif config.EMAIL_PROVIDER == 'postmark':
        return _sendEmailPostmark(subject, body, recipient)
    else:
        logger.warning('No email provider configured.')
        return None


def sendOTPCodeEmail(otpCode: str, recipient: str):
    template = Template.get_template('emails/otp_code.html').render(
        OTP_CODE=otpCode, AUTH_URL=f"{config.APP_URL}/auth?code={otpCode}"
    )

    return sendEmail('Login for Chrono', template, recipient)
