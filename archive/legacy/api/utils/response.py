from flask import jsonify

def success_response(data=None, message=None, status_code=200):
    """
    Standardized success response format.
    """
    response = {
        "success": True,
        "data": data,
    }
    if message:
        response["message"] = message
    return jsonify(response), status_code

def error_response(message="An error occurred", error_code="INTERNAL_SERVER_ERROR", details=None, status_code=500):
    """
    Standardized error response format.
    """
    response = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        }
    }
    if details:
        response["error"]["details"] = details
    return jsonify(response), status_code
