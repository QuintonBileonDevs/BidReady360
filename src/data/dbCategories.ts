export interface CategoryItemNode {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  level?: number;
  parentId?: string | null;
  sortOrder?: number;
  children?: {
    id?: string;
    code: string;
    name: string;
    description?: string | null;
    level?: number;
    parentId?: string | null;
    sortOrder?: number;
  }[];
}

export const DB_CATEGORIES: CategoryItemNode[] = [
  {
    "id": "a1000000-0000-0000-0000-000000000075",
    "code": "PPRA_01",
    "name": "Building Construction Works and Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000076",
    "code": "PPRA_02",
    "name": "Electrical Engineering Works and Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000077",
    "code": "PPRA_03",
    "name": "Civil Engineering Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000078",
    "code": "PPRA_05",
    "name": "Water and Sewage Treatment Plant Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000079",
    "code": "PPRA_06",
    "name": "Specialized Construction Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000080",
    "code": "PPRA_08",
    "name": "Mechanical Engineering Works and Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000081",
    "code": "PPRA_09",
    "name": "Drilling Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000082",
    "code": "PPRA_10",
    "name": "Water Engineering Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000001",
    "code": "PPRA_100",
    "name": "Security Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000001",
        "code": "PPRA_100_01",
        "name": "Security Guard Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000002",
        "code": "PPRA_100_02",
        "name": "Specialist Security Service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000003",
        "code": "PPRA_100_03",
        "name": "Closed protection Service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000004",
        "code": "PPRA_100_04",
        "name": "Electronic Security Service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000005",
        "code": "PPRA_100_05",
        "name": "Private Investigation Service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000006",
        "code": "PPRA_100_06",
        "name": "Security Advisory Service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000001",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000002",
    "code": "PPRA_101",
    "name": "Hotel and Catering (Restaurant) Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000007",
        "code": "PPRA_101_01",
        "name": "Hotel (Hotel, Motel, lodge, guest house) services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000002",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000008",
        "code": "PPRA_101_02",
        "name": "Restaurant and Food-serving services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000002",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000009",
        "code": "PPRA_101_03",
        "name": "Canteen and Catering services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000002",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000010",
        "code": "PPRA_101_04",
        "name": "Conference and Workshop services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000002",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000003",
    "code": "PPRA_102",
    "name": "Tourism and Travel Related Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000011",
        "code": "PPRA_102_01",
        "name": "Travel related services (Travel agencies)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000003",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000012",
        "code": "PPRA_102_02",
        "name": "Tour operator Services (Tourist information services)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000003",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000013",
        "code": "PPRA_102_03",
        "name": "Guide services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000003",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000014",
        "code": "PPRA_102_04",
        "name": "Holiday camp and self-service facilities",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000003",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000004",
    "code": "PPRA_103",
    "name": "Collection and Disposal of hazardous Material",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000015",
        "code": "PPRA_103_01",
        "name": "Sewage collection, disposal and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000016",
        "code": "PPRA_103_02",
        "name": "Refuse collection and disposal services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000017",
        "code": "PPRA_103_03",
        "name": "Clinical waste collection, disposal and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000018",
        "code": "PPRA_103_04",
        "name": "Chemical waste collection, disposal and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000019",
        "code": "PPRA_103_05",
        "name": "Used oil collection, disposal and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000020",
        "code": "PPRA_103_06",
        "name": "E-waste collection, disposal and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000021",
        "code": "PPRA_103_07",
        "name": "Scrap metal collection and disposal",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000022",
        "code": "PPRA_103_08",
        "name": "Arms and Ammunition collection and disposal",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000023",
        "code": "PPRA_103_09",
        "name": "Radiation material collection and disposal",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000024",
        "code": "PPRA_103_10",
        "name": "Explosives material collection and disposal",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000025",
        "code": "PPRA_103_11",
        "name": "Asbestos dismantling and disposal services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000004",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000005",
    "code": "PPRA_104",
    "name": "Maintenance of Vehicles, Machinery and other Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000026",
        "code": "PPRA_104_01",
        "name": "Light Vehicles",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000027",
        "code": "PPRA_104_02",
        "name": "Trucks, Trailers, Buses",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000028",
        "code": "PPRA_104_03",
        "name": "Hydraulics",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000029",
        "code": "PPRA_104_04",
        "name": "Tyre Repairs, wheel Alignment and balancing",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000030",
        "code": "PPRA_104_05",
        "name": "Panel Beating, Spray Painting and Body Protection Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000031",
        "code": "PPRA_104_06",
        "name": "Agricultural Machinery",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000032",
        "code": "PPRA_104_07",
        "name": "Heavy Machinery",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000033",
        "code": "PPRA_104_08",
        "name": "Refurbishment",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000034",
        "code": "PPRA_104_09",
        "name": "Components Overhaul",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000005",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000006",
    "code": "PPRA_105",
    "name": "Maintenance of Rolling Stock Machinery and other Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000035",
        "code": "PPRA_105_01",
        "name": "Locomotives",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000036",
        "code": "PPRA_105_02",
        "name": "Wagons",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000037",
        "code": "PPRA_105_03",
        "name": "Passenger Coaches",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000038",
        "code": "PPRA_105_04",
        "name": "Railway/Road Hoisting/Lifting Equipment",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000039",
        "code": "PPRA_105_05",
        "name": "Remanufacturing/Refurbishment",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000040",
        "code": "PPRA_105_06",
        "name": "Components overhaul",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000006",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000007",
    "code": "PPRA_106",
    "name": "Material Testing",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000041",
        "code": "PPRA_106_01",
        "name": "Material Testing",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000007",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000008",
    "code": "PPRA_107",
    "name": "Motor Vehicle Assessment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000042",
        "code": "PPRA_107_01",
        "name": "Motor Vehicle Assessment",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000008",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000009",
    "code": "PPRA_111",
    "name": "Maintenance of Vehicles Related Equipment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000043",
        "code": "PPRA_111_01",
        "name": "General machining and welding",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000044",
        "code": "PPRA_111_02",
        "name": "Hoist/Cranes",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000045",
        "code": "PPRA_111_03",
        "name": "Exhaust fitment and repairs",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000046",
        "code": "PPRA_111_04",
        "name": "Air conditioning",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000047",
        "code": "PPRA_111_05",
        "name": "Upholstery",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000048",
        "code": "PPRA_111_06",
        "name": "Windscreen, glass fitting and maintenance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000049",
        "code": "PPRA_111_07",
        "name": "Propeller shaft repairs and maintenance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000050",
        "code": "PPRA_111_08",
        "name": "Radiator service",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000051",
        "code": "PPRA_111_09",
        "name": "Fuel injector and nozzle service and repair",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000009",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000010",
    "code": "PPRA_112",
    "name": "Maintenance of Medical Equipment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000052",
        "code": "PPRA_112_01",
        "name": "Therapeutic and Diagnostic Radiation Equipment, Spares and Consumables",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000010",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000053",
        "code": "PPRA_112_02",
        "name": "Medical and Surgical Equipment, Spares and Accessories",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000010",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000011",
    "code": "PPRA_113",
    "name": "Aircraft Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000054",
        "code": "PPRA_113_01",
        "name": "Airframe, propeller and power plant",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000011",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000055",
        "code": "PPRA_113_02",
        "name": "Instruments and accessories",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000011",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000056",
        "code": "PPRA_113_03",
        "name": "Avionics and Radio",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000011",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000057",
        "code": "PPRA_113_04",
        "name": "Specialized services, upholstery, painting (refurbishments)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000011",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000058",
        "code": "PPRA_113_05",
        "name": "Non-destructive testing",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000011",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000012",
    "code": "PPRA_114",
    "name": "Boat Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000059",
        "code": "PPRA_114_01",
        "name": "Boat maintenance and repair services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000012",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000013",
    "code": "PPRA_115",
    "name": "Office Equipment Maintenance",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000060",
        "code": "PPRA_115_01",
        "name": "Office equipment and accessories",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000013",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000014",
    "code": "PPRA_116",
    "name": "Broadcasting and Audio-Visual Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000061",
        "code": "PPRA_116_01",
        "name": "Installation and maintenance of broadcasting and audio-visual equipment",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000014",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000062",
        "code": "PPRA_116_02",
        "name": "Installation of Studio and Hall Acoustics",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000014",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000063",
        "code": "PPRA_116_03",
        "name": "Remote Broadcast Services & Relaying of Feeds",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000014",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000015",
    "code": "PPRA_117",
    "name": "Broadcasting Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000064",
        "code": "PPRA_117_01",
        "name": "Radio broadcasting",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000015",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000065",
        "code": "PPRA_117_02",
        "name": "Television broadcasting",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000015",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000066",
        "code": "PPRA_117_03",
        "name": "Online Radio Broadcasting",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000015",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000067",
        "code": "PPRA_117_04",
        "name": "Online Television Broadcasting",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000015",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000016",
    "code": "PPRA_118",
    "name": "Telecommunication Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000068",
        "code": "PPRA_118_01",
        "name": "Public Telecommunications Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000016",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000069",
        "code": "PPRA_118_02",
        "name": "Network Facilities (telecom sites towers, satellite infrastructure fibre etc)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000016",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000070",
        "code": "PPRA_118_03",
        "name": "Value Added Services (IP Telephone Least Cost Routing, Conferencing etc)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000016",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000071",
        "code": "PPRA_118_04",
        "name": "Radio Communication services (e.g 2-way radio services)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000016",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000072",
        "code": "PPRA_118_05",
        "name": "Installation and maintenance of Telecommunications equipment and Systems",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000016",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000017",
    "code": "PPRA_119",
    "name": "Universal Postal Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000073",
        "code": "PPRA_119_01",
        "name": "Postal services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000017",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000074",
        "code": "PPRA_119_02",
        "name": "Courier services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000017",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000018",
    "code": "PPRA_120",
    "name": "ICT Technical Support Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000075",
        "code": "PPRA_120_01",
        "name": "Systems Development Services and maintenance services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000076",
        "code": "PPRA_120_02",
        "name": "Server Management and maintenance Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000077",
        "code": "PPRA_120_03",
        "name": "Data center maintenance & hosting facilities",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000078",
        "code": "PPRA_120_04",
        "name": "Desktop Management and maintenance Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000079",
        "code": "PPRA_120_05",
        "name": "Network Management and maintenance Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000080",
        "code": "PPRA_120_06",
        "name": "ICT Security Management and maintenance Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000081",
        "code": "PPRA_120_07",
        "name": "Internet Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000082",
        "code": "PPRA_120_08",
        "name": "ICT Risk Management Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000083",
        "code": "PPRA_120_09",
        "name": "Imaging, data capture and migration services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000018",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000019",
    "code": "PPRA_127",
    "name": "Insurance & Pension",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000084",
        "code": "PPRA_127_01",
        "name": "Pension funding services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000085",
        "code": "PPRA_127_02",
        "name": "Medical aid scheme services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000086",
        "code": "PPRA_127_03",
        "name": "Motor vehicle Insurance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000087",
        "code": "PPRA_127_04",
        "name": "Freight Insurance services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000088",
        "code": "PPRA_127_05",
        "name": "Fire and other property damage insurance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000089",
        "code": "PPRA_127_06",
        "name": "Brokerage and risk related Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000090",
        "code": "PPRA_127_07",
        "name": "Life Insurance Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000091",
        "code": "PPRA_127_08",
        "name": "Other Insurance and Pension Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000019",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000020",
    "code": "PPRA_128",
    "name": "Media Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000092",
        "code": "PPRA_128_01",
        "name": "Print Media",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000020",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000093",
        "code": "PPRA_128_02",
        "name": "Radio, Film & Television",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000020",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000094",
        "code": "PPRA_128_03",
        "name": "Other media services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000020",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000021",
    "code": "PPRA_129",
    "name": "Passenger Transport Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000095",
        "code": "PPRA_129_01",
        "name": "Air",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000021",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000096",
        "code": "PPRA_129_02",
        "name": "Land",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000021",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000097",
        "code": "PPRA_129_03",
        "name": "Water",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000021",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000098",
        "code": "PPRA_129_04",
        "name": "Rail",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000021",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000083",
    "code": "PPRA_13",
    "name": "Fencing - buildings, roads and others",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000022",
    "code": "PPRA_130",
    "name": "Freight Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000099",
        "code": "PPRA_130_01",
        "name": "Air",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000022",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000100",
        "code": "PPRA_130_02",
        "name": "Land",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000022",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000101",
        "code": "PPRA_130_03",
        "name": "Water",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000022",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000102",
        "code": "PPRA_130_04",
        "name": "Rail",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000022",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000103",
        "code": "PPRA_130_05",
        "name": "Other Transportation Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000022",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000023",
    "code": "PPRA_131",
    "name": "Rental Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000104",
        "code": "PPRA_131_01",
        "name": "Accommodation (Office/residential/industrial/commercial)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000105",
        "code": "PPRA_131_02",
        "name": "Motor Vehicles",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000106",
        "code": "PPRA_131_03",
        "name": "Machinery and equipment other than for Transport & Real estate",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000107",
        "code": "PPRA_131_04",
        "name": "Aircraft",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000108",
        "code": "PPRA_131_05",
        "name": "Boat",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000109",
        "code": "PPRA_131_06",
        "name": "Other rental services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000023",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000024",
    "code": "PPRA_132",
    "name": "Cleaning Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000110",
        "code": "PPRA_132_01",
        "name": "Building cleaning services (including windows, carpets and others)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000024",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000111",
        "code": "PPRA_132_03",
        "name": "Petroleum storage and equipment cleaning",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000024",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000112",
        "code": "PPRA_132_04",
        "name": "Hazardous Material",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000024",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000025",
    "code": "PPRA_133",
    "name": "Public Utilities",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000113",
        "code": "PPRA_133_01",
        "name": "Water distribution and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000025",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000114",
        "code": "PPRA_133_03",
        "name": "Electricity distribution and related services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000025",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000115",
        "code": "PPRA_133_04",
        "name": "Other sources of energy and distribution",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000025",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000116",
        "code": "PPRA_133_05",
        "name": "Meter reading services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000025",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000026",
    "code": "PPRA_134",
    "name": "Health Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000117",
        "code": "PPRA_134_01",
        "name": "Air ambulance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000118",
        "code": "PPRA_134_02",
        "name": "Road ambulance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000119",
        "code": "PPRA_134_03",
        "name": "Health Care services (allied health, dentistry, midwifery-obstetrics, medicine, nursing, optometry, pharmacy, psychosocial, physiotherapy, ENT, etc.)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000120",
        "code": "PPRA_134_04",
        "name": "Medical laboratory services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000121",
        "code": "PPRA_134_05",
        "name": "Veterinary services (including Veterinary laboratory)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000122",
        "code": "PPRA_134_06",
        "name": "Psychosocial",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000123",
        "code": "PPRA_134_07",
        "name": "Forensic laboratory services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000026",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000027",
    "code": "PPRA_135",
    "name": "Customs Clearing, forwarding and Shipping",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000124",
        "code": "PPRA_135_01",
        "name": "Customs clearing, forwarding and Shipping",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000027",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000028",
    "code": "PPRA_136",
    "name": "Auctioneering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000125",
        "code": "PPRA_136_01",
        "name": "Real estate auctioneering",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000028",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000126",
        "code": "PPRA_136_02",
        "name": "Movable auctioneering (plant, equipment, furniture, wildlife and livestock etc)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000028",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000029",
    "code": "PPRA_137",
    "name": "Gardening and Landscaping Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000127",
        "code": "PPRA_137_01",
        "name": "Gardening, landscaping and maintenance",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000029",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000128",
        "code": "PPRA_137_02",
        "name": "Nursery",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000029",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000030",
    "code": "PPRA_138",
    "name": "Marketing and Public Relation Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000129",
        "code": "PPRA_138_01",
        "name": "Marketing Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000030",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000130",
        "code": "PPRA_138_02",
        "name": "Advertising Services (billboards, electronic, internet, signage, infomercials, promotional material – content required)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000030",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000131",
        "code": "PPRA_138_03",
        "name": "Public relations services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000030",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000031",
    "code": "PPRA_139",
    "name": "Miscellaneous Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": [
      {
        "id": "b1000000-0000-0000-0000-000000000132",
        "code": "PPRA_139_01",
        "name": "Washing and dry cleaning services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000133",
        "code": "PPRA_139_02",
        "name": "Hairdressing and beauty treatment services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000134",
        "code": "PPRA_139_03",
        "name": "Physical wellbeing services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000135",
        "code": "PPRA_139_04",
        "name": "Entertainment services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000136",
        "code": "PPRA_139_05",
        "name": "Provision of call Centre services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000137",
        "code": "PPRA_139_06",
        "name": "Library and archives services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000138",
        "code": "PPRA_139_07",
        "name": "Secretarial services (Photocopying, binding, faxing, typing etc.)",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000139",
        "code": "PPRA_139_08",
        "name": "Miscellaneous equipment maintenance services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000140",
        "code": "PPRA_139_09",
        "name": "Photography Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000141",
        "code": "PPRA_139_10",
        "name": "Cremation services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000142",
        "code": "PPRA_139_11",
        "name": "Embroidery and engraving services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000143",
        "code": "PPRA_139_12",
        "name": "Florists services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000144",
        "code": "PPRA_139_13",
        "name": "Mobile toilets services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000145",
        "code": "PPRA_139_14",
        "name": "Exhibition space rental",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000146",
        "code": "PPRA_139_15",
        "name": "Mortuary services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000147",
        "code": "PPRA_139_16",
        "name": "Event Management Services",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000148",
        "code": "PPRA_139_17",
        "name": "Graphic Design",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000149",
        "code": "PPRA_139_20",
        "name": "Master of Ceremonies",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      },
      {
        "id": "b1000000-0000-0000-0000-000000000150",
        "code": "PPRA_139_21",
        "name": "Rapporteur",
        "description": null,
        "level": 2,
        "parentId": "a1000000-0000-0000-0000-000000000031",
        "sortOrder": 0
      }
    ]
  },
  {
    "id": "a1000000-0000-0000-0000-000000000084",
    "code": "PPRA_14",
    "name": "Roads - Ancillary Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000032",
    "code": "PPRA_140",
    "name": "Calibration Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000033",
    "code": "PPRA_141",
    "name": "Language & Interpretation Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000034",
    "code": "PPRA_142",
    "name": "Aviation Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000035",
    "code": "PPRA_143",
    "name": "Human Resources Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000036",
    "code": "PPRA_144",
    "name": "Training Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000037",
    "code": "PPRA_145",
    "name": "Safety Health and Environment Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000085",
    "code": "PPRA_15",
    "name": "Civil Aviation /Meteorological Electronics Works",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000038",
    "code": "PPRA_200",
    "name": "Agriculture Products and Related Equipment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000039",
    "code": "PPRA_201",
    "name": "Printed Matter and Related Equipment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000040",
    "code": "PPRA_202",
    "name": "Medical Supplies and Related Equipment",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000041",
    "code": "PPRA_203",
    "name": "Electrical, Electronic, Mechanical and ICT supplies",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000042",
    "code": "PPRA_207",
    "name": "Food Supplies",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000043",
    "code": "PPRA_208",
    "name": "Transport Equipment & Accessories",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000044",
    "code": "PPRA_209",
    "name": "Railway Transport Equipment & Accessories",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000045",
    "code": "PPRA_211",
    "name": "General Supplies",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000046",
    "code": "PPRA_212",
    "name": "Manufacturers/Producers of Agricultural Products and Related Products",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000047",
    "code": "PPRA_213",
    "name": "General Manufactures/Producers",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000048",
    "code": "PPRA_214",
    "name": "Petroleum Products",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000049",
    "code": "PPRA_216",
    "name": "Gases",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000050",
    "code": "PPRA_217",
    "name": "Media Supplies",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000051",
    "code": "PPRA_218",
    "name": "Psychosocial Material",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000052",
    "code": "PPRA_301",
    "name": "Architecture Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000053",
    "code": "PPRA_302",
    "name": "Quantity Surveying Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000054",
    "code": "PPRA_303",
    "name": "Civil Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000055",
    "code": "PPRA_304",
    "name": "Electrical Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000056",
    "code": "PPRA_305",
    "name": "Mechanical Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000057",
    "code": "PPRA_307",
    "name": "Mining Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000058",
    "code": "PPRA_308",
    "name": "Building Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000059",
    "code": "PPRA_310",
    "name": "Surveying Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000060",
    "code": "PPRA_311",
    "name": "Project Management Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000061",
    "code": "PPRA_312",
    "name": "Civil Aviation/Meteorological Electronics Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000062",
    "code": "PPRA_313",
    "name": "Environmental Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000063",
    "code": "PPRA_314",
    "name": "Finance Related Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000064",
    "code": "PPRA_315",
    "name": "Human Resource Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000065",
    "code": "PPRA_316",
    "name": "Real Estate Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000066",
    "code": "PPRA_317",
    "name": "Other Consultancy Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000067",
    "code": "PPRA_318",
    "name": "Legal Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000068",
    "code": "PPRA_319",
    "name": "ICT Consultancy Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000069",
    "code": "PPRA_320",
    "name": "Town and Regional Planning",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000070",
    "code": "PPRA_321",
    "name": "Dispute Resolution Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000071",
    "code": "PPRA_322",
    "name": "Health Care Consulting Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000072",
    "code": "PPRA_323",
    "name": "Energy Management Services (EMS)",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000073",
    "code": "PPRA_324",
    "name": "Fire Engineering Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  },
  {
    "id": "a1000000-0000-0000-0000-000000000074",
    "code": "PPRA_325",
    "name": "Geological Services",
    "description": null,
    "level": 1,
    "parentId": null,
    "sortOrder": 0,
    "children": []
  }
];
