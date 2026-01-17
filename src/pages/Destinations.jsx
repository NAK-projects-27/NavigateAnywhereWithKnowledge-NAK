import {useState, useEffect} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin , ArrowLeft, Sparkle } from "lucide-react";
import "../styles/global.css";

export default function Destination() {
    const {name} = useParams;
    const nav = useNavigate();

    const {loading ,setloading} = useState(true);
    const {destinationinfo , setdestinationinfo} = useState(null);

    useEffect(() => {
        const fetchDestinationInfo = async() => {
            await new Promise(resolve => setTimeout(resolve,1000));

        

        setdestinationinfo({
            name : name,
            description : `Welcome to {name}! This is an amazing place `,
            coordinates : { lat: 48.8566, lng: 2.3522 }

        });
        setloading(false);
    };

    fetchDestinationInfo();
    }, [name, setdestinationinfo, setloading]);

    if(loading){
        return(
            <div className = 'app-center'>
                <div className="card" style={{text_align : "cneter"}}>
                    <Sparkles size={40} style={{margin: "0 auto 16px"}}/>
                    <div style ={{fontSize : 18, fontWeight: 700}}>Loading Destination...</div>   
                </div>
            </div> 
        );
    }

    // Main page

    return(
        <div style={{padding : 28}}>
            <button
                onClick={() => nav("/")}
                className = "btn_ghost"
                style={{marginBottom : 20}}>

                <ArrowLeft size={16}/>Back to Home
            </button>

            <div className="card">
                <div style={{display : "flex", alignItems : "center" , gap: 12 , marginBottom : 16}}>
                    <MapPin size={32} style={{color : "var(--neon-cyan)"}}/>
                    <h1 style={{fontSize : 32 , margin : 0}}>{destinationinfo.name}</h1>

                </div>
                <p style={{ color: "var(--muted)", fontSize: 16 }}>
                    {destinationinfo.description}
                </p>

            </div>
        </div>

    );



}