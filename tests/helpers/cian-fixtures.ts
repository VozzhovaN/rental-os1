import type { NormalizedLongTermPublicationData } from "@/lib/publications/normalized-long-term";
import { COMMISSION_MAPPING_BLOCKED } from "@/lib/publications/normalized-long-term";

type DeepPartialNormalized = Omit<
  Partial<NormalizedLongTermPublicationData>,
  "property" | "contact" | "photos"
> & {
  property?: Partial<NormalizedLongTermPublicationData["property"]>;
  contact?: Partial<NormalizedLongTermPublicationData["contact"]>;
  photos?: NormalizedLongTermPublicationData["photos"];
};

export function makeNormalizedCianFixture(
  overrides: DeepPartialNormalized = {},
): NormalizedLongTermPublicationData {
  const base: NormalizedLongTermPublicationData = {
    listingId: "listing-golden-001",
    title: "Светлая квартира",
    description:
      "Светлая квартира у парка. Отдельная кухня, мебель, техника. Сдаётся на длительный срок.",
    monthlyPrice: 70000,
    specialOfferPrice: null,
    specialOfferText: null,
    deposit: 70000,
    commission: 0,
    commissionMapping: COMMISSION_MAPPING_BLOCKED,
    minimumRentalPeriodMonths: 6,
    property: {
      address: "ул. Тестовая, д. 1",
      city: "Тестовый город",
      district: "Район А",
      floor: 4,
      totalFloors: 9,
      rooms: 1,
      area: 42,
      bedrooms: 1,
      bathrooms: 1,
      type: "APARTMENT",
    },
    contact: {
      name: "Анна",
      phoneCountryCode: "7",
      phoneNumber: "9001234567",
    },
    photos: [
      {
        id: "photo-a",
        url: "https://cdn.example.com/a.jpg",
        order: 0,
        isPrimary: true,
      },
      {
        id: "photo-b",
        url: "https://cdn.example.com/b.jpg",
        order: 1,
        isPrimary: false,
      },
    ],
  };

  return {
    ...base,
    ...overrides,
    property: {
      ...base.property,
      ...overrides.property,
    },
    contact: {
      ...base.contact,
      ...overrides.contact,
    },
    photos: overrides.photos ?? base.photos,
  };
}
