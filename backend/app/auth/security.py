import uuid
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import User

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
dummy_hash = hasher.hash('dummy-unusable-password')


def verify(password, hashed):
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def token_for(user):
    current = datetime.now(timezone.utc)
    return jwt.encode({'sub': str(user.id), 'iat': current, 'exp': current + timedelta(minutes=settings().token_minutes), 'iss': 'bo-online-24bpm', 'aud': 'bo-api'}, settings().jwt_secret, algorithm='HS256')


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        if not credentials:
            raise ValueError()
        claims = jwt.decode(credentials.credentials, settings().jwt_secret, algorithms=['HS256'], issuer='bo-online-24bpm', audience='bo-api', options={'require': ['exp', 'iat', 'sub']})
        user = db.get(User, uuid.UUID(claims['sub']))
        if not user or not user.active:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, 'Sessão inválida ou expirada', headers={'WWW-Authenticate': 'Bearer'}) from None


def admin(user: User = Depends(current_user)):
    if user.role != 'ADMIN':
        raise HTTPException(403, 'Acesso administrativo necessário')
    return user
