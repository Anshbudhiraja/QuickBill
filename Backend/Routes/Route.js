const express = require("express");
const jwt=require("jsonwebtoken");
const mongoose = require("mongoose");
const { generateotp, verifyotp } = require("../Services/OtpService/OtpService");
const {otptoemailforverification} = require("../Services/EmailService/EmailService");
const HandleResponse=require("../HandleResponse/HandleResponse")
const checkuserdetails = require("../Middlewares/Checkuserdetails");
const { User, Shopkeeper, Executive } = require("../Model/UserModel/UserModel");
const Product=require("../Model/ProductModel/ProductModel")
const Customer = require("../Model/CustomerModel/CustomerModel");
const { Invoice, Transaction, Payment } = require("../Model/TransactionModel/TransactionModel");
const OrderedItems = require("../Model/OrderedItemModel/OrderedItemModel");
const Routes = express.Router();

Routes.get("/", async (req, resp) =>HandleResponse(resp,202,"Server Health is Okay"))
Routes.post("/verifyuser",checkuserdetails,async (req, resp) => {
  try {
    const { name, phone, email, password, address, city, state,role,executiveof } = req.body;

    if (!name || !phone || !email || !password || !city || city==="None" || !address || !state || state==="None" || !role) return HandleResponse(resp,404,"Field is Empty")
    if(typeof phone !== "number") return HandleResponse(resp,404,"Invalid Phone Number")
    const userRoleChecker=["Shopkeeper","Executive"]
    if(!userRoleChecker.includes(role)) return HandleResponse(resp,404,"This role is not exists")

    const existinguser = await User.findOne({ email });
    if (existinguser) return HandleResponse(resp,400,"Account already exists")

    if(role==="Executive"){
      if(!executiveof) return HandleResponse(resp,404,"Select the Shopkeeper")
      if(!mongoose.isValidObjectId(executiveof)) return HandleResponse(resp,401,"Invalid Shopkeeper id")
      const existingShopkeeper=await Shopkeeper.findOne({_id:executiveof})
      if(!existingShopkeeper) return HandleResponse(resp,404,"The Shopkeeper belong to this id is not exists")
    }      
    const otp = generateotp(email);
    return await otptoemailforverification(resp, email, otp);
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error);
  }
});
Routes.post("/createuser",checkuserdetails,async (req, resp) => {
  try {
    const { name, phone, email, address, password, city, state,role, otp,executiveof } =req.body;

    if (!name || !phone || !email || !address || !city || city==="None" || !state || state==="None" || !password ||!role) return HandleResponse(resp,404,"Field is Empty")
    if(typeof phone !== "number") return HandleResponse(resp,404,"Invalid Phone Number")
    
    if (!otp) return HandleResponse(resp,404,"Enter the otp");

    const userRoleChecker=["Shopkeeper","Executive"]
    if(!userRoleChecker.includes(role)) return HandleResponse(resp,404,"This role is not exists")

    const existinguser = await User.findOne({ email });
    if (existinguser) return HandleResponse(resp,400,"Account already exists")

    if(role==="Executive"){
      if(!executiveof) return HandleResponse(resp,404,"Select the Shopkeeper")
      if(!mongoose.isValidObjectId(executiveof)) return HandleResponse(resp,401,"Invalid Shopkeeper id")
      const existingShopkeeper=await Shopkeeper.findOne({_id:executiveof})
      if(!existingShopkeeper) return HandleResponse(resp,404,"The Shopkeeper belong to this id is not exists")
    }
    
    const response = verifyotp(email, otp);
    if (!response.status) return HandleResponse(resp,404,response.message);

    if(role==="Shopkeeper"){
    const result = await Shopkeeper.create({name,phone,email,password,address,city,state});
    return HandleResponse(resp,201,"Shopkeeper Account created successfully",result);
    }
    if(role==="Executive"){
    const result = await Executive.create({name,phone,email,password,address,city,state,executiveof});
    return HandleResponse(resp,201,"Executive Account created successfully",result); 
    }
  } catch (error) {
    console.log(error);
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});
Routes.post("/login", async (req, resp) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return HandleResponse(resp,404,"Field is Empty");

    const result = await User.findOne({ email });
    if (!result) return HandleResponse(resp,401,"Invalid Email");

    if (password === result.password) {
      if (!result.service) return HandleResponse(resp,401,"Your service is disabled");
      const payload={id:result._id}
      const token=jwt.sign(payload,process.env.JSON_SECRET_KEY)
      return HandleResponse(resp,202,"login successfully",{token,role:result.role})
    }
    return HandleResponse(resp,401,"Invalid Password");
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error);
  }
});
Routes.put("/enable",checkuserdetails, async (req, resp) => {
  try {
    const { id } = req.body;
    if (!id) return HandleResponse(resp,404,"Plz Select the user");

    const existinguser = await User.findOne({ _id: id });
    if (!existinguser) return HandleResponse(resp,404,"User is not found");

    const result = await User.updateOne({ _id: id },{ $set: { service: true } });
    return HandleResponse(resp,202,"Service is enabled",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});
Routes.put("/disable",checkuserdetails, async (req, resp) => {
  try {
    const { id } = req.body;
    if (!id) return HandleResponse(resp,404,"Plz Select the user");

    const existinguser = await User.findOne({ _id: id });
    if (!existinguser) return HandleResponse(resp,404,"User is not found");

    const result = await User.updateOne({ _id: id },{ $set: { service: false } });
    return HandleResponse(resp,202,"Service is disabled",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});
Routes.get("/getallusers",checkuserdetails,async(req,resp)=>{
  try {
    const users = await User.aggregate([{ $match: { role: "Shopkeeper" } },{ $lookup: {from: "users",localField: "_id",foreignField: "executiveof",as: "executives"}}, {$project: {password: 0, "executives.password": 0}}]).exec();
    if(users.length===0) return HandleResponse(resp,400,"No user found")
    return HandleResponse(resp,202,"Users fetched successfully",users)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
})
Routes.post("/fetchuserdetails",checkuserdetails,async(req,resp)=>{
  const payload={id:req.user._id}
  const token=jwt.sign(payload,process.env.JSON_SECRET_KEY)
  return HandleResponse(resp,202,"Login Successfully",{role:req.user.role,token})
})
Routes.post("/addproduct",checkuserdetails,async(req,resp)=>{
    try {
        const {name,company,model,description,price,discount,rate,tax,stock}=req.body
        if(!name ||!company ||!model ||!description ||!price ||!discount ||!rate ||!tax) return HandleResponse(resp,404,"Field is Empty")
        
        const existingproduct=await Product.findOne({model,userid:req.user._id})
        if(existingproduct) return HandleResponse(resp,400,"Product of this model already exists")
        
        const newproduct=await Product.create({userid:req.user._id,name,company,model:model,description,price,discount,rate,tax,stock})
        return HandleResponse(resp,201,"Product added successfully",newproduct)
    } catch (error) {     
        return HandleResponse(resp,500,"Internal Server error",null, error )
    }
})
Routes.get("/getproducts",checkuserdetails,async(req,resp)=>{
    try {
        const allproducts=await Product.find({userid:req.user._id})
        if(allproducts.length===0) return HandleResponse(resp,404,"Your product list is empty")
        
        return HandleResponse(resp,202,"All Products successfully fetched",allproducts)
    } catch (error) {
      return HandleResponse(resp,500,"Internal Server error",null, error )       
    }
})
Routes.delete("/deleteproduct/:id",checkuserdetails,async(req,resp)=>{
    try {
        const {id}=req.params
        if(!id) return HandleResponse(resp,404,"Plz select the product")
        
        const existingproduct=await Product.findOne({_id:id,userid:req.user._id})
        if(!existingproduct) return HandleResponse(resp,404,"This product is not found in your product list.")
        
        const result=await Product.deleteOne({_id:id,userid:req.user._id})
        return HandleResponse(resp,202,"Product deleted successfully",result)
    } catch (error) {
       return HandleResponse(resp,500,"Internal Server error",null, error );
    }
})
Routes.put("/updateproduct/:id",checkuserdetails,async(req,resp)=>{
    try {
        const {name,company,model,description,price,discount,rate,tax,stock}=req.body
        if(!name ||!company ||!model ||!description ||!price ||!discount ||!rate ||!tax ||!stock) return HandleResponse(resp,404,"Field is Empty")
        
        const {id}=req.params
        if(!id) return HandleResponse(resp,404,"Plz select the product")

        const existingproduct=await Product.findOne({_id:id,userid:req.user._id})
        if(!existingproduct) return HandleResponse(resp,404,"This product is not found in your product list")
        
        const response=await Product.findOne({model,userid:req.user._id})
        if(response && response._id.toString()!==id) return HandleResponse(resp,400,"Product of this model is already exists in your product list")

        const updatedproduct=await Product.updateOne({_id:id,userid:req.user._id},{$set:{name,company,model,description,price,discount,rate,tax,stock}})
        return HandleResponse(resp,202,"Product updated successfully",updatedproduct)
    } catch (error) {
        return HandleResponse(resp,500,"Internal Server error",null,error);
    }
})

const validateObjectKeys = (object, schema) => {
    const schemaKeys = Object.keys(schema.paths).filter((key) => key !== '__v' && key !== '_id' && key !== 'createdat');
    const objectKeys = Object.keys(object);

    for (const key of schemaKeys) {
      if (!object.hasOwnProperty(key) || object[key] === null || object[key] === '') return "The key "+key+" is missing or empty."
    }
  
    for (const key of objectKeys) {
      if (!schemaKeys.includes(key)) return "The key "+key+" is not declared in the schema."
    }

    return null;
};
Routes.post("/addmultipleproducts",checkuserdetails,async(req,resp)=>{
    try {
        const {items} = req.body;
        if (!Array.isArray(items) || items.length === 0) return HandleResponse(resp,400,'Invalid input. Provide an array of items.')
        const updateditems= items.map(item=>{return {...item,userid:req.user._id}})
        const errors = [];
        updateditems.map(async(item,index)=>{
            const validationError = validateObjectKeys(item, Product.schema);
            if (validationError) errors.push({ index, error: validationError })
        
            const existingproduct = await Product.findOne({ model: item.model });
            if(existingproduct) errors.push({ index, error: "The modelNumber " +item.model+" already exists."})
        })    
    
        if(errors.length > 0) return HandleResponse(resp,400,'Validation errors occurred.',null,errors);
    
        const result = await Product.insertMany(updateditems);
        return HandleResponse(resp,201,'All products are added successfully',result)
      } catch (error) {
        return HandleResponse(resp,500,'Internal Server Error',null,error);
       }
})

Routes.get("/getallshopkeepers",checkuserdetails,async(req,resp)=>{
 try {
  const result=await Shopkeeper.find().select("email _id")
  if(result.length===0) return HandleResponse(resp,400,"No Shopkeeper found")
  return HandleResponse(resp,202,"Shopkeeper fetched successfully",result)
 } catch (error) {
  return HandleResponse(resp,500,"Internal Server error",null,error)
 }
})
Routes.get("/getallcitiesandstates",checkuserdetails,async(req,resp)=>{
  try {
   const response=await fetch("https://city-state.netlify.app/index.json")
   const result=await response.json()
   if(response.status===200 && result.length!==0) return HandleResponse(resp,202,"Cities & States fetched successfully",result)
   return HandleResponse(resp,400,"Cities & States are not fetched successfully")
  } catch (error) {
   return HandleResponse(resp,500,"Internal Server error",null,error)
  }
})




Routes.post("/verifyexecutive",checkuserdetails,async (req, resp) => {
  try {
    const { name, phone, email, password, address, city, state } = req.body;

    if (!name || !phone || !email || !password || !city || city==="None" || !address || !state || state==="None") return HandleResponse(resp,404,"Field is Empty")

    const existinguser = await User.findOne({ email });
    if (existinguser) return HandleResponse(resp,400,"Account already exists")

    const otp = generateotp(email);
    return await otptoemailforverification(resp, email, otp);
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error);
  }
});
Routes.post("/createexecutive",checkuserdetails,async (req, resp) => {
  try {
    const { name, phone, email, address, password, city, state, otp } =req.body;

    if (!name || !phone || !email || !address || !city || city==="None" || !state || state==="None" || !password) return HandleResponse(resp,404,"Field is Empty")

    if (!otp) return HandleResponse(resp,404,"Enter the otp");

    const existinguser = await User.findOne({ email });
    if (existinguser) return HandleResponse(resp,400,"Account already exists")

    const response = verifyotp(email, otp);
    if (!response.status) return HandleResponse(resp,404,response.message);

    const result = await Executive.create({name,phone,email,password,address,city,state,executiveof:req.user._id});
    return HandleResponse(resp,201,"Account created successfully",result);
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});
Routes.get("/getallexecutives",checkuserdetails,async(req,resp)=>{
  try {
    const users = await Executive.find({executiveof:req.user._id}).select("-password")
    if(users.length===0) return HandleResponse(resp,400,"No user found")
    return HandleResponse(resp,202,"Users fetched successfully",users)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
})
Routes.put("/enableexecutive",checkuserdetails, async (req, resp) => {
  try {
    const { id } = req.body;
    if (!id) return HandleResponse(resp,404,"Plz Select the Executive");

    const existinguser = await Executive.findOne({ _id: id });
    if (!existinguser) return HandleResponse(resp,404,"Executive is not found");

    const result = await Executive.updateOne({ _id: id },{ $set: { service: true } });
    return HandleResponse(resp,202,"Service is enabled",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});
Routes.put("/disableexecutive",checkuserdetails, async (req, resp) => {
  try {
    const { id } = req.body;
    if (!id) return HandleResponse(resp,404,"Plz Select the Executive");

    const existinguser = await Executive.findOne({ _id: id });
    if (!existinguser) return HandleResponse(resp,404,"Executive is not found");

    const result = await Executive.updateOne({ _id: id },{ $set: { service: false } });
    return HandleResponse(resp,202,"Service is disabled",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server error",null,error)
  }
});


Routes.post("/createcustomer",checkuserdetails,async(req,resp)=>{
  try {
    const {name,phone,address}=req.body
    if(!name || !phone ||!address) return HandleResponse(resp,404,"Field is Empty")
    const existingcustomer=await Customer.findOne({phone,customerof:req.user._id})
    if(existingcustomer) return HandleResponse(resp,400,"Customer Already Exists")
    const newCustomer=await Customer.create({name,phone,address,customerof:req.user._id})
    return HandleResponse(resp,201,"Customer created successfully",newCustomer)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)  
  }
})
Routes.get("/getallcustomers",checkuserdetails,async(req,resp)=>{
  try {
    const existingcustomers=await Customer.find({customerof:req.user._id})
    if(!existingcustomers || existingcustomers.length===0) return HandleResponse(resp,404,"Customer list is empty")
    return HandleResponse(resp,202,"Customers fetched successfully",existingcustomers)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)  
  }
})



async function generateInvoiceNumber(shopkeeperId) {
  const lastInvoice = await Invoice.findOne({shopkeeperId}).sort({ _id: -1 });

  let newInvoiceNumber;
  if (lastInvoice) {
    let lastNumber = parseInt(lastInvoice.InvoiceNo.split('-')[1]) + 1;
    newInvoiceNumber = `INV-${lastNumber.toString().padStart(5, '0')}`;
  } else {
    newInvoiceNumber = 'INV-00001';
  }

   return newInvoiceNumber;
}

const validateordereditems = (object) => {
 if(Object.keys(object).length===0) return "Product Detail not found";
 if(!object.id || object.id==="" || object.id==null || !mongoose.isValidObjectId(object.id)) return "Product id is invalid";
 if(!object.quantity || object.quantity==="" || object.quantity===null || object.quantity<=0) return "Product quantity is invalid";
 return null;
};
Routes.post("/createInvoice/:id",checkuserdetails,async(req, resp) => {
 try {
  const {id} =req.params
 if(!id || !mongoose.isValidObjectId(id)) return HandleResponse(resp,404,"Customer is not valid")
 const existingCustomer=await Customer.findOne({_id:id})
 if(!existingCustomer) return HandleResponse(resp,404,"Customer not found")

  const {ordereditems}=req.body
  if(!ordereditems) return HandleResponse(resp,404,"Select the items")
  if (!Array.isArray(ordereditems) || ordereditems.length === 0) return HandleResponse(resp,400,'Invalid input. Provide an array of items.')
  
  const errors=[]
  ordereditems.map(async(item,index)=>{
    const validationError = validateordereditems(item);
    if (validationError) errors.push({ index, error: validationError })
  })
  if(errors.length > 0) return HandleResponse(resp,400,'Validation errors occurred.',null,errors);
  
  const allids= ordereditems.map(item=>new mongoose.Types.ObjectId(item.id))
  const allproducts=await Product.find({_id:{$in:allids}})
  if(allids.length!==allproducts.length) return  HandleResponse(resp,404,"One or More Products is missing")


  for(const item of ordereditems){
    const existingProduct= await Product.findOne({_id:item.id,userid:req.user._id})
    if(existingProduct.stock<item.quantity) return HandleResponse(resp,404,"Stock of this product:"+existingProduct.name+"is insufficient")
  }

  const newOrder=[]
  for(const item of ordereditems){
   const existingProduct= await Product.findOne({_id:item.id,userid:req.user._id})

    existingProduct.stock-=item.quantity
    await existingProduct.save()

   const {name,model,company,description,rate,price,tax,discount}= existingProduct
   const obj={name,model,company,description,rate,price,tax,discount,quantity:item.quantity,subtotal:price*item.quantity}
   newOrder.push(obj)
  }

  let totaltax=0
  let totaldiscount=0
  let totalcost=0
  let subtotal=0
  for(const item of newOrder){
    totaltax+=item.quantity*((item.price*item.tax)/100)
    totaldiscount+=item.quantity*((item.price*item.discount)/100)
    subtotal+=item.quantity*item.price
    totalcost+=item.quantity*item.rate
  }
  const grandtotal=subtotal-totaldiscount+totaltax
  const totalprofit=grandtotal-totalcost-totaldiscount-totaltax

  const orders=await OrderedItems.insertMany(newOrder)
  const allid=orders.map(obj=>obj._id)
  const invoiceNumber = await generateInvoiceNumber(req.user._id);

  existingCustomer.balance+=parseInt(grandtotal)
  await existingCustomer.save()

  const result = await Invoice.create({InvoiceNo: invoiceNumber,OrderItems:allid,TotalAmount:parseInt(grandtotal),Subtotal:subtotal,TotalProfit:totalprofit,TotalDiscount:totaldiscount,TotalTax:totaltax,customerId:id,shopkeeperId:req.user._id});
  // const resultingItems=await OrderedItems.find({_id:{$in:allid}})
  return HandleResponse(resp,201,'Invoice generated successfully',{result,ordereditems:newOrder});
 } catch (error) {  
  return HandleResponse(resp,500,"Internal Server Error",null,error)
 }
})

Routes.get("/getCustomer/:id",checkuserdetails,async(req,resp)=>{
  try {
    const {id}=req.params
    if(!id || !mongoose.isValidObjectId(id)) return HandleResponse(resp,404,"Customer is not valid")
      
    const existingCustomer=await Customer.findOne({_id:id,customerof:req.user._id})
    if(!existingCustomer) return HandleResponse(resp,404,"Customer is not found in your list")
    return HandleResponse(resp,202,"Customer fetched successfully",existingCustomer)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)
  }
})
Routes.get("/getShopkeeper",checkuserdetails,async(req,resp)=>{
  try {
    const existingShopkeeper=await Shopkeeper.findOne({_id:req.user._id}).select("-password -_id")
    if(!existingShopkeeper) return HandleResponse(resp,404,"Shopkeeper is not found in your list")
    return HandleResponse(resp,202,"Shopkeeper fetched successfully",existingShopkeeper)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)
  }
})

Routes.get("/getalltransactions/:id",checkuserdetails,async(req,resp)=>{
  try {
    const {id} =req.params
    if(!id || !mongoose.isValidObjectId(id)) return HandleResponse(resp,404,"Customer is not valid")

    const existingCustomer=await Customer.findOne({_id:id})
    if(!existingCustomer) return HandleResponse(resp,404,"Customer not found")

    const result=await Transaction.find({shopkeeperId:req.user._id,customerId:id})
    if(!result || result.length === 0) return HandleResponse(resp,404,"Transaction list is empty")
    return HandleResponse(resp,202,"Transactions fetched successfully",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)
  }
})


async function generateRecieptNumber(shopkeeperId) {
  const lastreciept = await Payment.findOne({shopkeeperId}).sort({ _id: -1 });

  let newReciept;
  if (lastreciept) {
    let lastNumber = parseInt(lastreciept.RecieptNo.split('-')[1]) + 1;
    newReciept = `Reciept-${lastNumber.toString().padStart(5, '0')}`;
  } else {
    newReciept = 'Reciept-00001';
  }

   return newReciept;
}
Routes.post("/addpayment/:id",checkuserdetails,async(req,resp)=>{
  try {
    const {payment,Description}=req.body
    if(!payment) return HandleResponse(resp,404,"Amount is required")

    const {id}=req.params
    if(!id ||!mongoose.isValidObjectId(id)) return HandleResponse(resp,404,"Customer is not valid")
    
    const existingCustomer=await Customer.findOne({_id:id,customerof:req.user._id})
    if(!existingCustomer) return HandleResponse(resp,404,"Customer is not found in your list")


    existingCustomer.balance-=payment
    await existingCustomer.save()
    const reciept=generateRecieptNumber(req.user._id)
    const result=await Payment.create({shopkeeperId:req.user._id,customerId:id,RecieptNo:reciept,payment,Description})
    return HandleResponse(resp,201,"Customer updated successfully",result)
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)
  }
})



Routes.get("/getSalesInfo",checkuserdetails,async(req,resp)=>{
  try {
    const allInvoices=await Invoice.find({shopkeeperId:req.user._id}).select("TotalAmount TotalTax TotalDiscount TotalProfit Subtotal")
    let totalSales=0
    let totalTax=0
    let totalDiscount=0
    let totalProfit=0
    let totalSalesWithoutTaxAndDiscount=0
    for(const invoice of allInvoices){
      totalSales+=invoice.TotalAmount
      totalTax+=invoice.TotalTax
      totalProfit+=invoice.TotalProfit
      totalDiscount+=invoice.TotalDiscount
      totalSalesWithoutTaxAndDiscount+=invoice.Subtotal
    }
    const allPayments=await Payment.find({shopkeeperId:req.user._id}).select("payment")
    const totalPayment=allPayments.reduce((acc,payment) => acc+payment.payment,0)
    return HandleResponse(resp,202,"Data Analysed Successfully",{totalSales,totalTax,totalDiscount,totalProfit,totalSalesWithoutTaxAndDiscount,totalPayment})
  } catch (error) {
    return HandleResponse(resp,500,"Internal Server Error",null,error)
  }
})

Routes.get("/latestInvoices",checkuserdetails,async(req,resp)=>{
  try {
  const allInvoices=await Invoice.find({shopkeeperId:req.user._id}).sort({ createdAt: -1 }).limit(7).populate("customerId","name");
  if(!allInvoices || allInvoices.length===0) return HandleResponse(resp,404,"No latest invoices found")
  return HandleResponse(resp,202,"Latest invoices fetched successfully",allInvoices)
  } catch (error) {
   return HandleResponse(resp,500,"Internal Server Error",null,error)
  }  
})

Routes.get("/latestTransactions",checkuserdetails,async(req,resp)=>{
try {
  const latestTransactions=await Transaction.find({shopkeeperId:req.user._id}).sort({createdAt:-1}).limit(10)
  if(!latestTransactions || latestTransactions.length===0) return HandleResponse(resp,404,"No latest transactions found")
  return HandleResponse(resp,202,"Latest transactions fetched successfully",latestTransactions)
} catch (error) {
  return HandleResponse(resp,500,"Internal Server Error",null,error)
}
})
module.exports = Routes;  