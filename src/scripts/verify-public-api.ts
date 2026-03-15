import axios from 'axios';

async function verify() {
  const API_URL = 'http://localhost:8000/api';
  const storeSlug = 'demo-store';
  const pageSlug = 'testmatjar';
  
  console.log(`Testing Public API: ${API_URL}/stores/${storeSlug}/pages/${pageSlug}`);
  
  try {
    const res = await axios.get(`${API_URL}/stores/${storeSlug}/pages/${pageSlug}`);
    console.log('✅ Success! API returned page:', res.data.title);
    console.log('Status Profile:', res.data.status);
  } catch (error: any) {
    console.error('❌ Failed!', error.response?.status, error.response?.data);
  }
}

verify();
