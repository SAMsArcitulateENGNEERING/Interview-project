#!/usr/bin/env python3
"""
Test script for the new exam features:
1. Automatic cleanup of expired exams
2. Default trial exam creation
3. Date validation
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test_active_exams():
    """Test getting active exams (should exclude expired ones)"""
    print("🔍 Testing active exams endpoint...")
    response = requests.get(f"{BASE_URL}/api/active_exams")
    if response.status_code == 200:
        exams = response.json()
        print(f"✅ Found {len(exams)} active exams:")
        for exam in exams:
            print(f"  - {exam['title']} (ID: {exam['id']})")
            if exam.get('days_until_expiry'):
                print(f"    Days until expiry: {exam['days_until_expiry']}")
    else:
        print(f"❌ Failed to get active exams: {response.status_code}")

def test_cleanup_endpoint():
    """Test manual cleanup endpoint"""
    print("\n🧹 Testing manual cleanup endpoint...")
    response = requests.post(f"{BASE_URL}/api/cleanup_exams")
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Cleanup result: {result}")
    else:
        print(f"❌ Cleanup failed: {response.status_code}")

def test_create_expired_exam():
    """Test creating an exam with past end date (should be cleaned up)"""
    print("\n⏰ Testing expired exam creation...")
    
    # Create exam with end date in the past
    past_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
    
    exam_data = {
        "title": "Expired Test Exam",
        "description": "This exam should be automatically cleaned up",
        "duration": 30,
        "end_date": past_date
    }
    
    response = requests.post(f"{BASE_URL}/api/create_exam", json=exam_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Created expired exam with ID: {result.get('exam_id')}")
        return result.get('exam_id')
    else:
        print(f"❌ Failed to create expired exam: {response.status_code}")
        return None

def test_trial_exam():
    """Test that trial exam exists and is accessible"""
    print("\n🎯 Testing trial exam...")
    
    # Get all exams to find the trial exam
    response = requests.get(f"{BASE_URL}/api/active_exams")
    if response.status_code == 200:
        exams = response.json()
        trial_exam = None
        for exam in exams:
            if "Trial" in exam['title']:
                trial_exam = exam
                break
        
        if trial_exam:
            print(f"✅ Found trial exam: {trial_exam['title']} (ID: {trial_exam['id']})")
            print(f"   Description: {trial_exam['description']}")
            print(f"   Duration: {trial_exam['duration']} minutes")
            print(f"   Questions: {trial_exam['question_count']}")
            
            # Test getting trial exam questions
            questions_response = requests.get(f"{BASE_URL}/api/exam/{trial_exam['id']}/questions")
            if questions_response.status_code == 200:
                questions = questions_response.json()
                print(f"   Sample questions: {len(questions)}")
                for i, q in enumerate(questions[:2]):  # Show first 2 questions
                    print(f"     Q{i+1}: {q['text'][:50]}...")
        else:
            print("❌ Trial exam not found")
    else:
        print(f"❌ Failed to get exams: {response.status_code}")

def main():
    print("🚀 Testing new exam features...")
    print("=" * 50)
    
    # Test 1: Check active exams
    test_active_exams()
    
    # Test 2: Check trial exam
    test_trial_exam()
    
    # Test 3: Create expired exam
    expired_exam_id = test_create_expired_exam()
    
    # Test 4: Manual cleanup
    test_cleanup_endpoint()
    
    # Test 5: Check active exams again (should be same or fewer)
    print("\n🔍 Checking active exams after cleanup...")
    test_active_exams()
    
    print("\n✅ Feature testing complete!")

if __name__ == "__main__":
    main() 