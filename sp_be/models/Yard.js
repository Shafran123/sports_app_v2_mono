// Sport Yard model structure
const yardSchema = {
  name: String,
  description: String,
  sports: Array, // Array of sports available at this yard
  pricePerHour: String,
  frequency: String,
  isActive: Boolean,
  location: {
    lat: Number,
    lng: Number
  },
  created_by: String, // Admin ID who created this yard
  created_at: Date
};

module.exports = yardSchema; 