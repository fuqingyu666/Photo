const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// 测试用户登录，获取token
async function login() {
    try {
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'test@example.com',
            password: '123456'
        });

        return response.data.token;
    } catch (error) {
        console.error('登录失败:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// 测试初始化上传
async function testInitUpload(token) {
    try {
        const form = new FormData();

        // 读取测试图片文件
        const testImagePath = path.join(__dirname, 'test-image.jpg');
        if (!fs.existsSync(testImagePath)) {
            // 如果测试图片不存在，创建一个简单的测试文件
            fs.writeFileSync(testImagePath, 'Test image content');
        }

        const file = fs.readFileSync(testImagePath);
        form.append('chunk', file, 'test-image.jpg');

        console.log('发送初始化上传请求...');
        const response = await axios.post('http://localhost:5000/api/upload/init', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('初始化上传成功:', response.data);
        return response.data.upload.id;
    } catch (error) {
        console.error('初始化上传失败:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// 主测试函数
async function runTest() {
    try {
        // 1. 登录获取token
        console.log('开始登录...');
        const token = await login();
        console.log('登录成功，获取到token');

        // 2. 测试初始化上传
        const uploadId = await testInitUpload(token);
        console.log('测试完成!');
    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

// 运行测试
runTest(); 