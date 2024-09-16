const express = require('express')
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT ||5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY) 

//middleWares
const corsOptions = {
  origin: ['http://localhost:5173' , "******"],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());

//mongodb----------


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zd2hkzs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    
    const menuCollection = client.db("bossDb").collection("menu");
    const userCollection = client.db("bossDb").collection("users");
    const reviewCollection = client.db("bossDb").collection("review")
    const cartsCollection = client.db("bossDb").collection("carts")
    const paymentsCollection = client.db("bossDb").collection("payments")

    app.get('/menu',async(req,res)=> {
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.get('/menu/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id:id}
      const result = await menuCollection.findOne(query)
      res.send(result)
    })

    app.patch('/menu/:id',async(req,res)=>{
      const id = req.params.id;
      const item= req.body;
      const filter = {_id:id}
      const updatedDoc = { 
        $set:{
          name : item.name,
          recipe : item.recipe,
          price : item.price,
          image : item.image,
          category : item.category
        }
      }
      const result = await menuCollection.updateOne(filter,updatedDoc)
      res.send(result)
    })

    app.post('/menu',async(req,res)=>{
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem)
      res.send(result)
    })

    app.delete('/menu/:id',async(req,res)=>{
      const id = req.params.id;
      console.log(id)
      const query = {_id: id}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/review',async(req,res)=> {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    //cart collection
    app.post('/carts',async(req,res)=>{
      const cartItem = req.body;
      console.log(cartItem)
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    })

     

    //get cart
    app.get('/carts',async(req,res)=>{
      const email = req.query.email;
      const query ={email:email}
      const result = await cartsCollection.find(query).toArray();
      res.send(result)
    })



    app.delete("/carts/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })
    app.delete("/users/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    //middleware
    const verifyToken = (req,res,next) => {
      console.log('inside verify token',req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message:"forbidden access"})
      }
      const token = req.headers.authorization.split(' ')[1];
      console.log("token correction",token)
       jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(401).send({message:"forbidden"})
        }
      req.decoded = decoded;
      next();
    }) 
      
    } 
    //verify admin 
    const verifyAdmin = async (req,res,next) =>{
      const email = req.decoded.email;
      const query = {email:email};
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message:'forbidden access'})
      } 
      next()
    }
    

    //user collection
    app.post("/users",verifyToken,async(req,res)=>{
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    //authorize user 
    app.get('/users/admin/:email',verifyToken,async(req,res)=>{
      const email = req.params.email;
      if(email!=req.decoded.email){
        return res.status(403).send({message: `unathorized`})
      }

      const query = {email:email}
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user.role === 'admin'
      }
      res.send({admin})
    })

    //get user collection 
    app.get("/users",async(req,res)=>{
      
      const user = req.body;
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    //create admin 
    app.patch('/users/admin/:id',async(req,res)=>{
      const id = req.params.id;
      const filter ={_id: new ObjectId(id)} 
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter,updatedDoc)
      res.send(result)
    })
    

    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'
      });
      res.send({token});
    })

    //payment Method
    app.post("/create-payment-intent",async(req,res)=>{
      const {price} = req.body;
      console.log(price)
      
      const amount = parseInt(price*100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      console.log('payment intent is',paymentIntent)
      res.send({clientSecret:paymentIntent.client_secret})
    })

    app.post("/payments",async(req,res)=>{
      const payment = req.body;
      console.log(payment.cartId.map(id=> id))
      const paymentResult = await paymentsCollection.insertOne(payment)
      console.log('payment info',payment)
      const query = {_id:{
        $in: payment.cartId.map(id=>new ObjectId(id))
      }};
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({paymentResult,deleteResult})
    })

    //Admin Home
    app.get("/admin-stats",async(req,res)=>{
      const menuItems = await menuCollection.estimatedDocumentCount();
      const oreders = await paymentsCollection.estimatedDocumentCount();
      const users = await userCollection.estimatedDocumentCount();

      /* const payments = await paymentsCollection.find().toArray()
      const revenue = payments.reduce((total,items)=> total+items.price ,0) */

      const result = await paymentsCollection.aggregate([{
        $group:{
          _id:null,
          totalRevenue: {$sum:"$price"}
        } 
      }]).toArray()

      const revenue = result.length>0?result[0].totalRevenue : 0;

      res.send({users,menuItems,oreders,revenue})
    })
    
    // Send a ping to confirm a successful  connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!"); 
  } finally {
    // Ensures that the client will close when you finish/error
    
  }
}
run().catch(console.dir);



app.get('/',(req,res) => {
   res.send('boss is sitting')
})

app.listen(port,()=>{
    console.log(`bistro boss is sitting on ${port}`)
})