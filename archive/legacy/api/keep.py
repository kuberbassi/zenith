# api/keep.py
# Brain Dump notes storage using MongoDB (Google Keep API is enterprise-only)

from flask import Blueprint, jsonify, session, request
from bson import ObjectId
from datetime import datetime
import traceback
from api.database import db

keep_bp = Blueprint('keep', __name__, url_prefix='/api/keep')

# MongoDB collection for notes
notes_collection = db.get_collection('brain_dump_notes') if db is not None else None


@keep_bp.route('/notes', methods=['GET'])
def list_notes():
    """Fetch all notes for the current user from MongoDB."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if not notes_collection:
        return jsonify({"error": "Database not available"}), 500

    try:
        user_email = session['user'].get('email')
        notes = list(notes_collection.find(
            {'owner_email': user_email, 'trashed': {'$ne': True}},
            sort=[('updated_at', -1)]
        ))
        
        # Format notes for frontend
        formatted_notes = []
        for note in notes:
            formatted_notes.append({
                'id': str(note['_id']),
                'title': note.get('title', ''),
                'body': note.get('body', ''),
                'color': note.get('color', 'DEFAULT'),
                'createTime': note.get('created_at').isoformat() if note.get('created_at') else None,
                'updateTime': note.get('updated_at').isoformat() if note.get('updated_at') else None,
                'trashed': note.get('trashed', False)
            })
        
        return jsonify(formatted_notes)
        
    except Exception as e:
        print(f"Notes Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Internal error"}), 500


@keep_bp.route('/notes', methods=['POST'])
def create_note():
    """Create a new note in MongoDB."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if not notes_collection:
        return jsonify({"error": "Database not available"}), 500

    data = request.json
    title = data.get('title', '')
    body = data.get('body', '')
    color = data.get('color', 'DEFAULT')

    try:
        user_email = session['user'].get('email')
        now = datetime.utcnow()
        
        note = {
            'owner_email': user_email,
            'title': title,
            'body': body,
            'color': color,
            'created_at': now,
            'updated_at': now,
            'trashed': False
        }
        
        result = notes_collection.insert_one(note)
        
        return jsonify({
            'id': str(result.inserted_id),
            'title': title,
            'body': body,
            'color': color,
            'createTime': now.isoformat(),
            'updateTime': now.isoformat()
        }), 201
        
    except Exception as e:
        print(f"Create Note Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Internal error"}), 500


@keep_bp.route('/notes/<note_id>', methods=['PATCH'])
def update_note(note_id):
    """Update a note in MongoDB."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if not notes_collection:
        return jsonify({"error": "Database not available"}), 500

    data = request.json

    try:
        user_email = session['user'].get('email')
        
        update_data = {'updated_at': datetime.utcnow()}
        if 'title' in data:
            update_data['title'] = data['title']
        if 'body' in data:
            update_data['body'] = data['body']
        if 'color' in data:
            update_data['color'] = data['color']
        
        result = notes_collection.update_one(
            {'_id': ObjectId(note_id), 'owner_email': user_email},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            return jsonify({"error": "Note not found"}), 404
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Update Note Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Internal error"}), 500


@keep_bp.route('/notes/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    """Delete (trash) a note in MongoDB."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if not notes_collection:
        return jsonify({"error": "Database not available"}), 500

    try:
        user_email = session['user'].get('email')
        
        # Soft delete by marking as trashed
        result = notes_collection.update_one(
            {'_id': ObjectId(note_id), 'owner_email': user_email},
            {'$set': {'trashed': True, 'updated_at': datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            return jsonify({"error": "Note not found"}), 404
        
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Delete Note Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Internal error"}), 500
