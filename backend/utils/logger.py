import logging
import sys

# Configure logging format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

def get_logger(name: str) -> logging.Logger:
    """Returns a configured logger instance."""
    return logging.getLogger(name)
