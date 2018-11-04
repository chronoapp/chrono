
from flask_migrate import Migrate, MigrateCommand
from flask_script import Manager
from api import app, db

migrate = Migrate(app, db)
manager = Manager(app)

# migrations
manager.add_command('db', MigrateCommand)

if __name__ == '__main__':
    manager.run()


@manager.command
def create_db():
    """Creates the db tables."""
    db.create_all()


@manager.command
def drop_db():
    """Drops the db tables."""
    db.drop_all()
