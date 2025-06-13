import os
import sys
import json
from datetime import datetime

def log_info(message):
    print(f"ℹ️  {message}")

def log_success(message):
    print(f"✅ {message}")

def log_error(message):
    print(f"❌ {message}")

def convert_using_cli(h5_path, output_dir, model_name):
    """Convert using tensorflowjs_converter CLI tool"""
    try:
        # Check if .h5 file exists
        if not os.path.exists(h5_path):
            log_error(f"{model_name} model not found: {h5_path}")
            return False
        
        log_info(f"Converting {model_name} using CLI...")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Use CLI converter (more stable)
        cmd = f'tensorflowjs_converter --input_format=keras "{h5_path}" "{output_dir}"'
        log_info(f"Running: {cmd}")
        
        exit_code = os.system(cmd)
        
        if exit_code == 0 and os.path.exists(os.path.join(output_dir, "model.json")):
            log_success(f"{model_name} converted successfully!")
            
            # List generated files
            files = os.listdir(output_dir)
            log_info(f"Generated files:")
            for file in sorted(files):
                file_path = os.path.join(output_dir, file)
                size = os.path.getsize(file_path)
                log_info(f"  📄 {file} ({size:,} bytes)")
            
            return True
        else:
            log_error(f"CLI conversion failed for {model_name}")
            return False
            
    except Exception as e:
        log_error(f"Error converting {model_name}: {str(e)}")
        return False

def main():
    print("🚀 ML Model Converter (CLI Method)")
    print("=" * 60)
    
    # Define paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, "models")
    
    # Model configurations
    models_config = [
        {
            "h5_file": "model_nlp.h5",
            "output_dir": "model_nlp",
            "name": "NLP Model"
        },
        {
            "h5_file": "model_pilgan.h5", 
            "output_dir": "model_pilgan",
            "name": "Quiz Model"
        }
    ]
    
    conversion_results = []
    
    # Convert each model
    for config in models_config:
        h5_path = os.path.join(models_dir, config["h5_file"])
        output_dir = os.path.join(models_dir, config["output_dir"])
        
        print("\n" + "-" * 60)
        success = convert_using_cli(h5_path, output_dir, config["name"])
        conversion_results.append({
            "model": config["name"],
            "success": success
        })
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 CONVERSION SUMMARY")
    print("=" * 60)
    
    successful_conversions = sum(1 for r in conversion_results if r["success"])
    total_models = len(conversion_results)
    
    for result in conversion_results:
        status = "✅ SUCCESS" if result["success"] else "❌ FAILED"
        print(f"{status} - {result['model']}")
    
    print(f"\n📊 Results: {successful_conversions}/{total_models} models converted successfully")
    
    if successful_conversions > 0:
        log_success("🎉 Models ready for Express.js deployment!")
        
        print("\n📋 NEXT STEPS:")
        print("1. Install in Express.js: npm install @tensorflow/tfjs-node")
        print("2. Copy models/ folder to your Express.js project")
        print("3. Load models in your Express.js app")
        
        # Create Express.js example
        create_express_example()

def create_express_example():
    """Create example Express.js code for loading models"""
    express_code = '''// models/modelLoader.js
const tf = require('@tensorflow/tfjs-node');
const path = require('path');

class ModelLoader {
    constructor() {
        this.models = {};
        this.isLoaded = false;
    }

    async loadModels() {
        try {
            console.log('🔄 Loading ML models...');
            
            // Load NLP model
            const nlpModelPath = 'file://' + path.join(__dirname, 'model_nlp/model.json');
            this.models.nlp = await tf.loadLayersModel(nlpModelPath);
            console.log('✅ NLP model loaded');
            
            // Load Quiz model
            const quizModelPath = 'file://' + path.join(__dirname, 'model_pilgan/model.json');
            this.models.quiz = await tf.loadLayersModel(quizModelPath);
            console.log('✅ Quiz model loaded');
            
            this.isLoaded = true;
            console.log('🎉 All models loaded successfully!');
            
        } catch (error) {
            console.error('❌ Error loading models:', error);
            throw error;
        }
    }

    predict(modelType, inputData) {
        if (!this.isLoaded) {
            throw new Error('Models not loaded yet');
        }
        
        const model = this.models[modelType];
        if (!model) {
            throw new Error(`Model ${modelType} not found`);
        }
        
        // Convert input to tensor
        const tensor = tf.tensor(inputData);
        const prediction = model.predict(tensor);
        
        // Convert back to array
        const result = prediction.dataSync();
        
        // Clean up tensors
        tensor.dispose();
        prediction.dispose();
        
        return Array.from(result);
    }

    getModelInfo() {
        return {
            loaded: this.isLoaded,
            models: Object.keys(this.models),
            nlp: this.models.nlp ? {
                inputs: this.models.nlp.inputs.map(i => ({
                    name: i.name,
                    shape: i.shape
                }))
            } : null,
            quiz: this.models.quiz ? {
                inputs: this.models.quiz.inputs.map(i => ({
                    name: i.name,
                    shape: i.shape
                }))
            } : null
        };
    }
}

module.exports = new ModelLoader();

// routes/ml.js
const express = require('express');
const router = express.Router();
const modelLoader = require('../models/modelLoader');

// Initialize models when server starts
router.get('/status', (req, res) => {
    try {
        const info = modelLoader.getModelInfo();
        res.json({
            success: true,
            ...info
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Predict with NLP model
router.post('/predict/nlp', (req, res) => {
    try {
        const { input } = req.body;
        if (!input) {
            return res.status(400).json({
                success: false,
                error: 'Input data required'
            });
        }
        
        const prediction = modelLoader.predict('nlp', input);
        
        res.json({
            success: true,
            prediction,
            model: 'nlp'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Predict with Quiz model
router.post('/predict/quiz', (req, res) => {
    try {
        const { input } = req.body;
        if (!input) {
            return res.status(400).json({
                success: false,
                error: 'Input data required'
            });
        }
        
        const prediction = modelLoader.predict('quiz', input);
        
        res.json({
            success: true,
            prediction,
            model: 'quiz'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

// app.js (main Express app)
const express = require('express');
const mlRoutes = require('./routes/ml');
const modelLoader = require('./models/modelLoader');

const app = express();
app.use(express.json());

// Load models on startup
modelLoader.loadModels().catch(console.error);

// ML routes
app.use('/api/ml', mlRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
'''
    
    with open("express_example.js", "w") as f:
        f.write(express_code)
    
    log_success("Express.js example created: express_example.js")

if __name__ == "__main__":
    main()