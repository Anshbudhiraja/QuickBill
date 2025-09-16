const HandleResponse = require("../HandleResponse/HandleResponse")
const { User } = require("../Model/UserModel/UserModel")
const jwt=require("jsonwebtoken")
const checkuserdetails=async(req,resp,next)=>{
    const token=req.header("Authorization")
    if(!token) return HandleResponse(resp,404,"Token is not found")
    const {id}=jwt.verify(token,process.env.JSON_SECRET_KEY)
    if(!id) return HandleResponse(resp,401,"Token is not valid")
    const existinguser=await User.findById(id).select("-password")
    if(!existinguser) return HandleResponse(resp,401,"Unauthorised user")
    req.user=existinguser
    next()
}
module.exports=checkuserdetails