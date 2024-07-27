import axios from 'axios';

const urlConfig = {
  https: ' https://api-merchant.payos.vn',
};

const apiClient = axios.create({
  baseURL: urlConfig.https,
  // timeout: 1000,
  headers: { 'Content-Type': 'application/json' },
});

export default apiClient;
