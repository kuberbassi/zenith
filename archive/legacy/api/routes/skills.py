from flask import Blueprint, jsonify, session, request, Response
from api.database import db
from api.utils.response import success_response, error_response
from api.auth import login_required
from bson import ObjectId, json_util
from datetime import datetime
import logging
from api.rate_limiter import limiter, RELAXED_LIMIT, MODERATE_LIMIT

logger = logging.getLogger(__name__)

skills_bp = Blueprint('skills', __name__)
skills_collection = db.get_collection('skills')

@skills_bp.route('/', methods=['GET'])
@limiter.limit(RELAXED_LIMIT)
def get_skills():
    """Get all skills for the current user."""
    if 'user' not in session:
        return error_response("Unauthorized", "UNAUTHORIZED", status_code=401)
    
    user_email = session['user']['email'].lower()  # ✅ Normalized
    skills = list(skills_collection.find({'owner_email': user_email}).sort('created_at', -1))
    
    import json
    return success_response(json.loads(json_util.dumps(skills)))

@skills_bp.route('/', methods=['POST'])
@limiter.limit(MODERATE_LIMIT)
def add_skill():
    """Add a new skill."""
    if 'user' not in session:
        return error_response("Unauthorized", "UNAUTHORIZED", status_code=401)
    
    try:
        data = request.json
        if not data:
            return error_response("No data provided", "INVALID_DATA")
            
        user_email = session['user']['email'].lower()  # ✅ Normalized
        
        skill = {
            'owner_email': user_email,
            'name': data.get('name'),
            'category': data.get('category'),
            'level': data.get('level'),
            'progress': data.get('progress', 0),
            'notes': data.get('notes', ''),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = skills_collection.insert_one(skill)
        skill['_id'] = result.inserted_id
        
        db.get_collection('system_logs').insert_one({
            'owner_email': user_email,
            'action': "Skill Added",
            'description': f"Added skill: {skill['name']}",
            'timestamp': datetime.utcnow()
        })
        
        import json
        return success_response(json.loads(json_util.dumps(skill)))
    except Exception as e:
        logger.error(f"Error adding skill: {str(e)}")
        return error_response("Failed to add skill", "INTERNAL_ERROR")

@skills_bp.route('/<skill_id>', methods=['PUT'])
@limiter.limit(MODERATE_LIMIT)
def update_skill(skill_id):
    """Update an existing skill."""
    if 'user' not in session:
        return error_response("Unauthorized", "UNAUTHORIZED", status_code=401)
    
    data = request.json
    user_email = session['user']['email'].lower()  # ✅ Normalized
    
    update_data = {
        'updated_at': datetime.utcnow()
    }
    
    if 'name' in data: update_data['name'] = data['name']
    if 'category' in data: update_data['category'] = data['category']
    if 'level' in data: update_data['level'] = data['level']
    if 'progress' in data: update_data['progress'] = data['progress']
    if 'notes' in data: update_data['notes'] = data['notes']
    
    result = skills_collection.update_one(
        {'_id': ObjectId(skill_id), 'owner_email': user_email},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        return error_response("Skill not found", "NOT_FOUND", status_code=404)
    
    db.get_collection('system_logs').insert_one({
        'owner_email': user_email,
        'action': "Skill Updated",
        'description': f"Updated skill: {data.get('name', skill_id)}",
        'timestamp': datetime.utcnow()
    })
    
    return success_response({"message": "Skill updated successfully"})

@skills_bp.route('/<skill_id>', methods=['DELETE'])
@limiter.limit(MODERATE_LIMIT)
def delete_skill(skill_id):
    """Delete a skill."""
    if 'user' not in session:
        return error_response("Unauthorized", "UNAUTHORIZED", status_code=401)
    
    user_email = session['user']['email'].lower()  # ✅ Normalized
    
    skill = skills_collection.find_one({'_id': ObjectId(skill_id), 'owner_email': user_email})
    if not skill:
        return error_response("Skill not found", "NOT_FOUND", status_code=404)
        
    result = skills_collection.delete_one({'_id': ObjectId(skill_id), 'owner_email': user_email})
    
    db.get_collection('system_logs').insert_one({
        'owner_email': user_email,
        'action': "Skill Deleted",
        'description': f"Deleted skill: {skill.get('name', 'Unknown')}",
        'timestamp': datetime.utcnow()
    })
    
    return success_response({"message": "Skill deleted successfully"})
