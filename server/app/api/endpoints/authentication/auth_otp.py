import pyotp
import logging

from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, status, HTTPException, APIRouter
from base64 import b32encode

from app.core import config
from app.db.models.user import User
from app.utils.emails import sendOTPCodeEmail

from app.api.utils.db import get_db
from app.api.repos.user_repo import UserRepository
from .token_utils import getAuthToken

router = APIRouter()

"""Sign in with One Time Password (OTP)"""

TOPT_INTERVAL = 60 * 5


class OTPUser(BaseModel):
    email: str


class OTPVerifyRequest(BaseModel):
    email: str
    code: str


def getPyOTP(userId: int) -> pyotp.TOTP:
    tokenSecret = f'{userId}-{config.TOKEN_SECRET}'
    encoded = b32encode(bytearray(tokenSecret, 'ascii')).decode('utf-8')

    return pyotp.TOTP(encoded, interval=TOPT_INTERVAL)


@router.post('/auth/otp/login')
def loginWithOTP(otpUser: OTPUser, session: Session = Depends(get_db)):
    """Sends a login code to the user's email address."""
    userRepo = UserRepository(session)
    user = userRepo.getUserByEmail(otpUser.email)

    logging.info(f'Login with OTP: {otpUser.email}')

    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Invalid email.')

    totp = getPyOTP(user.id)

    try:
        sendOTPCodeEmail(totp.now(), user.email)
        return {}
    except:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Could not verify code.')


@router.post('/auth/otp/verify')
def verifyOTP(otpVerify: OTPVerifyRequest, session: Session = Depends(get_db)):
    """Verifies the login code and returns a JWT token."""

    userRepo = UserRepository(session)
    user = userRepo.getUserByEmail(otpVerify.email)

    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'User not found.')

    totp = getPyOTP(user.id)
    if not totp.verify(otpVerify.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid code.')

    authToken = getAuthToken(user)

    return {'token': authToken}
