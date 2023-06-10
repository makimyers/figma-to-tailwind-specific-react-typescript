import { useState, useEffect } from 'react'
import axios from 'axios';
import namer from 'color-namer';

function App() {

    interface TailwindConfig {
        theme: {
            extend: {
                fontSize: { [size: string]: string[] };
                fontFamily: { [type: string]: string[] };
                colors: { [colorName: string]: string; };
            };
        };
        variants: {};
        plugins: any[];
    }

    interface FigmaNameItem {
        parentKey: string; // new
        className: string; // new
        id: string;
        name: string;
        type: string;
        style: {
            fontFamily: string;
            fontSize: string;
            fontWeight: string;
        }
        fills: {
            blendMode: string;
            color: {
                r: number;
                g: number;
                b: number;
            }
        }[];
    }

    interface FigmaStyleItem {
        styles: {
            text: string;
        };
        style: {
            fontFamily: string;
            fontSize: string;
            fontWeight: string;
            lineHeightPx: number;
            color: string;
        };
    }

    interface CombinedObject {
        name: string;
        className: string;
        style: {
            fontFamily: string;
            fontSize: string;
            fontWeight: string;
            lineHeightPx: number;
            color: string;
        };
    }

    interface Text extends CombinedObject {
        className: string; // new field
    }

    const [isLoading, setLoading] = useState(false);
    const [figmaId, setFigmaId] = useState<string>();
    const [error, setError] = useState<string | null>(null);



    useEffect(() => {
        const figmaID = window.location.pathname.split('/')[1];
        if (figmaID) {
            setFigmaId(figmaID)
        }
    }, [])

    const [textArray, setTextArray] = useState<CombinedObject[]>([]);

    // Search for these within the Figma object
    const headings = ['/H1 ', '/H2 ', '/H3 ', '/H4 ', '/H5 ', '/H6 ', '/XL ', '/L ', '/M ', '/S ', '/XS ']

    interface Color {
        name: string;
        color: string;
    }
    const [colorArray, setColorArray] = useState<Color[]>([]);

    const findFigmaNameItems = (data: object): FigmaNameItem[] => {
        let result: FigmaNameItem[] = [];

        const search = (obj: any, parentKey?: string) => {
            if (typeof obj !== 'object' || obj === null) return;

            if (obj.name) {
                for (const heading of headings) {
                    if (obj.name.includes(heading)) {
                        let className = heading.trim().slice(1); // Remove leading slash and trailing space

                        let newItem = {
                            ...obj as FigmaNameItem,
                            parentKey: parentKey as string,
                            className: className.toLowerCase()
                        };
                        result.push(newItem);
                        break; // If a match is found, no need to check other headings for this object
                    }
                }
            }

            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    search(obj[key], key);
                }
            }
        };

        search(data);
        return result;
    };

    const findParentObject = (data: object, targetKey: string): object | null => {
        let result: null = null;

        const search = (obj: any) => {
            if (result || typeof obj !== 'object' || obj === null) return;

            if (obj.styles && obj.styles.text === targetKey) {
                result = obj;
            } else {
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        search(obj[key]);
                    }
                }
            }
        };

        search(data);
        return result;
    };

    const rgbToHex = (r: number, g: number, b: number): string => {
        r = Math.floor(r * 255);
        g = Math.floor(g * 255);
        b = Math.floor(b * 255);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    };


    const findColorBlocks = (data: any): Color[] => {
        let colors: Color[] = [];

        const search = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) return;

            if (obj.name === "Colour block" && obj.fills && obj.fills.length) {
                const hexColor = rgbToHex(obj.fills[0].color.r, obj.fills[0].color.g, obj.fills[0].color.b);
                const colorName = namer(hexColor).ntc[0].name.replace(/\s/g, '').toLowerCase();
                colors.push({ name: colorName, color: hexColor });
                // console.log(obj)
            }

            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    search(obj[key]);
                }
            }
        };

        search(data);
        return colors;
    };

    const combineObjects = (figmaNameItems: FigmaNameItem[], figmaStyleItems: FigmaStyleItem[]): Text[] => {
        let combinedObjects: Text[] = [];

        for (const nameItem of figmaNameItems) {
            for (const styleItem of figmaStyleItems) {
                if (nameItem.parentKey === styleItem.styles.text) {
                    combinedObjects.push({
                        name: nameItem.name,
                        className: nameItem.className,
                        style: styleItem.style,
                    });
                    break; // assuming there's only one matching styleItem for each nameItem
                }
            }
        }

        return combinedObjects;
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                setLoading(true)
                setError(null); // reset error
                const result = await axios.get(`https://api.figma.com/v1/files/${figmaId}`, {
                    headers: {
                        'X-Figma-Token': import.meta.env.VITE_FIGMA_TOKEN
                    }
                });

                console.log("ALL DATA", result.data)
                const figmaNameItems = findFigmaNameItems(result.data.styles)
                console.log("TEST", figmaNameItems)

                let figmaStyleItems = [];

                /* for (const nameItem of figmaNameItems) {
                  let parentObject = findParentObject(result.data, nameItem.parentKey);
                  if (parentObject) {
                    figmaStyleItems.push(parentObject);
                  }
                } */

                for (const nameItem of figmaNameItems) {
                    let parentObject = findParentObject(result.data, nameItem.parentKey);
                    if (parentObject) {
                        figmaStyleItems.push(parentObject as FigmaStyleItem);
                    }
                }

                const combinedObjects = combineObjects(figmaNameItems, figmaStyleItems);
                console.log("Combined Objects", combinedObjects);

                let uniqueCombinedObjects = combinedObjects.filter((item, index, self) =>
                    index === self.findIndex((t) => (
                        t.name.split('/').pop() === item.name.split('/').pop()
                    ))
                );

                const sortedUniqueCombinedObjects = uniqueCombinedObjects.sort((a, b) => {
                    const aIndex = headings.findIndex(heading => a.name.includes(heading));
                    const bIndex = headings.findIndex(heading => b.name.includes(heading));
                    return aIndex - bIndex;
                });

                setTextArray(sortedUniqueCombinedObjects);

                const newTailwindConfig = generateTailwindConfig(sortedUniqueCombinedObjects, colorArray);
                setTailwindConfig(newTailwindConfig);



                const colorBlocks = findColorBlocks(result.data);
                console.log("COLOURS BLOCK", colorBlocks)
                setColorArray(colorBlocks);

                setLoading(false)
            } catch (err) {
                // set error message
                setError(err.response ? err.response.data.message : err.message);
                setLoading(false);
            }

        };

        // fetchData();
        fetchData();
    }, [figmaId]); // trigger when figmaID changes

    const [tailwindConfig, setTailwindConfig] = useState<TailwindConfig | null>(null);

    const generateTailwindConfig = (textArray: CombinedObject[], colorArray: Color[]): TailwindConfig => {
        const tailwindConfig: TailwindConfig = {
            theme: {
                extend: {
                    fontSize: {},
                    fontFamily: {},
                    colors: {},
                }
            },
            variants: {},
            plugins: [],
        };

        for (const text of textArray) {
            const { className, style } = text;
            const fontSize = style.fontSize + 'px'; // convert to px
            const lineHeight = Math.round(style.lineHeightPx) + 'px'; // convert to px
            const fontFamily = style.fontFamily.toLowerCase().replace(/\s/g, ''); // convert to lower case and remove spaces

            tailwindConfig.theme.extend.fontSize[className] = [fontSize, lineHeight];
            if (!tailwindConfig.theme.extend.fontFamily[fontFamily]) {
                tailwindConfig.theme.extend.fontFamily[fontFamily] = [style.fontFamily];
            }
        }

        for (const color of colorArray) {
            const { name, color: colorValue } = color;
            tailwindConfig.theme.extend.colors[name] = colorValue;
        }

        console.log(JSON.stringify(tailwindConfig, null, 2))
        return tailwindConfig;
    }

    return (
        <>
            {error &&
                <div>{error}</div>
            }

            {!isLoading && !figmaId &&
                <div>
                    Add Figma ID to URL
                </div>
            }

            {isLoading &&
                <div>LOADING</div>
            }

            {!isLoading && figmaId &&
                <div>
                    <pre>{JSON.stringify(tailwindConfig, null, 2)}</pre>

                    <ul>
                        {colorArray.map((item, index) => (
                            <li key={index} style={{ backgroundColor: item.color }}>
                                {item.name} : {item.color}
                            </li>
                        ))}
                    </ul>
                    <ul>
                        {textArray.map((item, index) => (
                            <li key={index} className={`text-${item.style.fontSize}`}>
                                {item.name} / {item.style.fontSize}
                            </li>
                        ))}
                    </ul>
                </div>
            }
        </>
    )
}

export default App;
