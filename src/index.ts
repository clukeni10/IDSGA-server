import express, { Request, Response } from 'express';
import { DataTypes, Model, Sequelize } from 'sequelize'
import dotenv from 'dotenv';
import cors from 'cors';
import multer from "multer"
import fs from "fs"
import { PersonType } from './types/PersonType';
import { CardType } from './types/CardType';
import path from 'path';
import { CardVehicleType } from './types/CardVehicleType';


dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (_, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

app.use(express.json({ limit: '50mb' }));

const corsOptions = {
    origin: '*',
    methods: 'GET, POST, PUT',
    allowedHeaders: ['Content-Type', 'Authorization', 'api-key', 'user'],
    credentials: true
};

app.use(cors(corsOptions));

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

const sequelize = new Sequelize('sga_cards', 'root', '12345', {
    host: 'localhost',
    dialect: 'mysql'
});

try {
    sequelize.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

const Escorts = sequelize.define('escorts', {
        personEscort: {
            type: DataTypes.STRING
        }
    }
);

const Functions = sequelize.define('functions', {
        personFunction: {
            type: DataTypes.STRING
        }
    }
);

const Card = sequelize.define('cards', {
        expiration: {
            type: DataTypes.DATE
        },
        cardNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Person = sequelize.define('persons', {
        name: {
            type: DataTypes.STRING
        },
        job: {
            type: DataTypes.STRING
        },
        escort: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        image: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }
);

const Entity = sequelize.define('entities', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Permission = sequelize.define('permissions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    permission: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

const CardVehicle = sequelize.define('card_vehicles', {
    entity: {
        type: DataTypes.STRING,
        allowNull: false
    },
    brand: {
        type: DataTypes.STRING,
        allowNull: false
    },
    expiration: {
        type: DataTypes.DATE,
        allowNull: false
    },
    cardNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    color: {
        type: DataTypes.STRING,
        allowNull: false
    },
    licensePlate: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

Entity.sync()
Person.sync()
Card.sync()
Permission.sync()
Functions.sync()
Escorts.sync()
CardVehicle.sync()

Person.belongsTo(Entity, {
    foreignKey: {
        name: 'entityId',
        allowNull: false,
    },
    as: 'entity'
});

Card.belongsTo(Person, {
    foreignKey: {
        name: 'personId',
        allowNull: false,
    },
    as: 'person'
});

const PersonPermissions = sequelize.define('person_permissions', {}, { timestamps: false });
Person.belongsToMany(Permission, { through: PersonPermissions });
Permission.belongsToMany(Person, { through: PersonPermissions });

CardVehicle.belongsTo(Entity, {
    foreignKey: {
        name: 'entityId',
        allowNull: false
    },
    as: 'relatedEntity'
});

 /*(async () => {
    await CardVehicle.sync({ alter: true }); // Adiciona colunas faltantes
    console.log("Tabela card_vehicles alterada com sucesso!");
})(); */

/*(async () => {
    await sequelize.sync({ force: true }); 

    // Inserir permissÃµes
    const permissions = ['A', 'B', 'C', 'D', 'E', 'F'].map(permission => ({ permission }));
    await Permission.bulkCreate(permissions);
    await PersonPermissions.sync({ force: true });

    console.log("Tabela 'permissions' populada com sucesso!");
})(); */

app.post('/card/save', upload.single('image'), async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body
        const imagePath = req.file ? req.file.path : null;
        const entity = await Entity.findOne<Model<{ name: string, id: number }>>({where: { name: body.entity }});
        const data = entity?.dataValues;

        const person = await Person.create({ 
            name: body.name, 
            job: body.job, 
            escort: body.escort, 
            entityId: data?.id,
            image: imagePath
        })

        const accessType = JSON.parse(body.accessType as unknown as string);

        const permissions = await Permission.findAll({
            where: { permission: accessType }
        });
    
        await (person as any).addPermissions(permissions);
    
        await Card.create({ expiration: new Date(body.expiration), cardNumber: body.cardNumber, personId: person.dataValues.id });

        res.status(200).json({ success: true })
    } catch (error) {
        console.log(error)
        res.status(501).send(error)
    }
});

app.put('/card/save', upload.single('image'), async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body;
        const imagePath = req.file ? req.file.path : null;

        if (!body.personId) {
            res.status(400).json({ success: false, message: "Person ID is required for update" });
            return
        }

        const entity = await Entity.findOne<Model<{ name: string, id: number }>>({ where: { name: body.entity } });
        const data = entity?.dataValues;

        const person = await Person.findByPk(body.personId);
        if (!person) {
            res.status(404).json({ success: false, message: "Person not found" });
            return
        }

        await person.update({
            name: body.name,
            job: body.job,
            escort: body.escort,
            entityId: data?.id,
            image: imagePath || (person.dataValues as any).image,
        });

        const accessType = JSON.parse(body.accessType as unknown as string);
        console.log('accessType:', accessType);

        const permissions = await Permission.findAll({
            where: { permission: [accessType] },
        });

        await (person as any).setPermissions(permissions);

        const card = await Card.findOne({ where: { personId: body.personId } });
        if (card) {
            await card.update({
                expiration: new Date(body.expiration),
                cardNumber: body.cardNumber,
            });
        } else {
            await Card.create({
                expiration: new Date(body.expiration),
                cardNumber: body.cardNumber,
                personId: person.dataValues.id,
            });
        }

        res.status(200).json({ success: true, message: "Data updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(501).send(error)
    }
});

app.post('/card-vehicle/save', async (req: Request<{}, {}, CardVehicleType>, res: Response): Promise<void> => {
    try {
        const body = req.body;
        console.log(body)
        
        const entity = await Entity.findOne({ where: { name: body.vehicle.entity } });

        if (!entity) {
            res.status(404).json({ success: false, message: "Entity or Vehicle not found" });
            return;
        }

        await CardVehicle.create({
            entity: body.vehicle.entity,
            brand: body.vehicle.brand,
            color: body.vehicle.color,
            cardNumber: body.cardNumber,
            licensePlate: body.vehicle.licensePlate,
            type: body.vehicle.type,
            entityId: entity.dataValues.id,
            expiration: body.expiration,
            permitType: body.permitType,
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(501).send(error);
    }
});

app.put('/card-vehicle/save', async (req: Request<{}, {}, CardVehicleType & { licensePlate: string }>, res: Response): Promise<void> => {
    try {
        const body = req.body;

        console.log("UPDATE: ", body)

        const cardVehicle = await CardVehicle.findOne({ 
            where: { licensePlate: body.licensePlate }
        });

        if (!cardVehicle) {
            res.status(404).json({ success: false, message: "CardVehicle not found" });
            return;
        }
        
        


        const entity = await Entity.findOne({ where: { name: body.vehicle.entity } });

        if (!entity) {
            res.status(404).json({ success: false, message: "Entity or Vehicle not found" });
            return;
        }

        await cardVehicle.update({
            entity: body.vehicle.entity,
            brand: body.vehicle.brand,
            color: body.vehicle.color,
            licensePlate: body.vehicle.licensePlate,
            type: body.vehicle.type,
            entityId: entity.dataValues.id,
            expiration: body.expiration,
            permitType: body.permitType, 
            
        });

        res.status(200).json({ success: true, message: "CardVehicle updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(501).send(error);
    }
});

app.get('/card-vehicle/getAll', async (_: Request, res: Response) => {
    try {
        const cardVehicles = await CardVehicle.findAll({});
        res.status(200).json(cardVehicles);
    } catch (error) {
        res.status(501).send(error);
    }
});


app.post('/setup/vehicle/save', async (req: Request<{}, {}, { brand: string }>, res: Response) => {
    try {
        const { brand } = req.body;
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(501).send(error);
    }
});

app.post('/setup/function/save', async (req: Request<{}, {}, { personFunction: string }>, res: Response) => {
    try {
        const body = req.body
        console.log(body)
        await Functions.create({ personFunction: body.personFunction })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/escort/save', async (req: Request<{}, {}, { personEscort: string }>, res: Response) => {
    try {
        const body = req.body
        await Escorts.create({ personEscort: body.personEscort })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/entity/save', async (req: Request<{}, {}, { name: string }>, res: Response) => {
    try {
        const body = req.body;
        await Entity.create({ name: body.name });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(501).send(error);
    }
});

app.get('/setup/entity/getAll', async (_: Request, res: Response) => {
    const entities = await Entity.findAll<Model<{ name: string }>>();
    res.status(200).json(entities);
});

app.get('/card/getAll', async (_: Request, res: Response) => {
    const persons = await Card.findAll<Model<PersonType>>({
        include: {
            model: Person,
            as: 'person',
            include: [
                {
                    model: Entity,
                    as: 'entity' 
                },
                {
                    model: Permission,
                    as: 'permissions'
                }
            ]
        },
    })

    res.status(200).json(persons)
})
app.get('/setup/function/getAll', async (_: Request, res: Response) => {
    const funs = await Functions.findAll<Model<{ personFunction: string }>>()
    res.status(200).json(funs)
})

app.get('/setup/escort/getAll', async (_: Request, res: Response) => {
    const escorts = await Escorts.findAll<Model<{ personEscort: string }>>()
    res.status(200).json(escorts)
})

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});