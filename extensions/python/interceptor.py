import os

from awslambdaric import bootstrap

subscribed_to_sqs = os.environ["SSPY_SUBSCRIBED_TO_SQS"] == "true"
debug_mode = os.environ["SSPY_DEBUG"] == "true"

_print = print


def handler(event, context):
    spied_function_name = os.environ["SSPY_FUNCTION_NAME"]
    original_handler_name = os.environ["ORIGINAL_HANDLER"]
    original_handler = bootstrap._get_handler(original_handler_name)
