import enum


class AccountType(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    credit_card = "credit_card"
    savings = "savings"
    investment = "investment"
    other = "other"


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class ExpenseNature(str, enum.Enum):
    fixed = "fixed"              # fijo/esencial: alquiler, comida esencial, seguros
    variable = "variable"        # variable necesario: gasolina, servicios
    discretionary = "discretionary"  # prescindible: restaurante, cine, antojos


class TransactionSource(str, enum.Enum):
    manual = "manual"
    receipt_scan = "receipt_scan"


class NatureSource(str, enum.Enum):
    user = "user"
    ai = "ai"


class BudgetPeriod(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
