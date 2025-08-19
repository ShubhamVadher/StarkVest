const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true
  },
  average_price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  
}, { _id: false }); 

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user', 
    required: true
  },
  stocks: [stockSchema]
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
