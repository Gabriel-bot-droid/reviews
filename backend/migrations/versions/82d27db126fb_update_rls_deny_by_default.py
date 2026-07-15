"""update_rls_deny_by_default

Revision ID: 82d27db126fb
Revises: 4c263d6a49ff
Create Date: 2026-07-10 17:11:00.082611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82d27db126fb'
down_revision: Union[str, Sequence[str], None] = '4c263d6a49ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Eliminar políticas SELECT antiguas
    op.execute("DROP POLICY IF EXISTS locations_select_policy ON locations;")
    op.execute("DROP POLICY IF EXISTS nfc_cards_select_policy ON nfc_cards;")
    
    # 2. Crear nuevas políticas SELECT seguras que exigen explícitamente el rol 'anonymous'
    op.execute("""
        CREATE POLICY locations_select_policy ON locations
        FOR SELECT USING (
            current_setting('app.current_user_role', true) = 'superadmin'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.current_user_role', true) = 'anonymous'
        );
    """)
    op.execute("""
        CREATE POLICY nfc_cards_select_policy ON nfc_cards
        FOR SELECT USING (
            current_setting('app.current_user_role', true) = 'superadmin'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.current_user_role', true) = 'anonymous'
        );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Eliminar políticas SELECT nuevas
    op.execute("DROP POLICY IF EXISTS locations_select_policy ON locations;")
    op.execute("DROP POLICY IF EXISTS nfc_cards_select_policy ON nfc_cards;")
    
    # 2. Recrear políticas SELECT antiguas (que permitían rol NULL por defecto)
    op.execute("""
        CREATE POLICY locations_select_policy ON locations
        FOR SELECT USING (
            current_setting('app.current_user_role', true) = 'superadmin'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_user_role', true), '') IS NULL
        );
    """)
    op.execute("""
        CREATE POLICY nfc_cards_select_policy ON nfc_cards
        FOR SELECT USING (
            current_setting('app.current_user_role', true) = 'superadmin'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_user_role', true), '') IS NULL
        );
    """)
