import { VehicleType } from "./VehicleType";

export type CardVehicleType = {
    vehicle: VehicleType
    expiration: Date
    cardNumber: string;
    permitType: string; 
 
}