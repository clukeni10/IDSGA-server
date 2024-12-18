import { PersonType } from "./PersonType"

export type CardType = {
    person: PersonType
    expiration: Date
    cardNumber: string
}