import argparse
from getpass import getpass
from sqlalchemy import select
from app.auth.security import hasher
from app.db.session import SessionLocal
from app.models.entities import Bulletin, User
from app.schemas.user import UserCreate
from app.services.bulletins import deliver


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['create-admin', 'retry-pending'])
    args = parser.parse_args()
    if args.command == 'create-admin':
        username = input('Usuario do administrador: ').strip().lower()
        name = input('Nome: ').strip()
        password = getpass('Senha (mínimo 12 caracteres): ')
        if password != getpass('Confirme a senha: '):
            raise SystemExit('Senhas diferentes')
        data = UserCreate(username=username, name=name, password=password, role='ADMIN')
        with SessionLocal() as db:
            if db.scalar(select(User).where(User.username == data.username)):
                raise SystemExit('E-mail já cadastrado')
            db.add(User(username=data.username, email=None, name=data.name, password_hash=hasher.hash(data.password), role='ADMIN'))
            db.commit()
        print('Administrador criado.')
    else:
        with SessionLocal() as db:
            pending = [(b.id, b.created_by) for b in db.scalars(select(Bulletin).where(Bulletin.status == 'ISSUED', (Bulletin.recipient_email_status == 'PENDING') | (Bulletin.battalion_email_status == 'PENDING')))]
        for bid, uid in pending:
            deliver(bid, uid)
        print(f'{len(pending)} boletins processados.')


if __name__ == '__main__':
    main()
